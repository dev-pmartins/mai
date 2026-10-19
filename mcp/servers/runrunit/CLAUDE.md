# CLAUDE.md — mcp-server-runrunit

## Overview

MCP server (Model Context Protocol) para integração com a API do Runrun.it (Runrunit).
Permite que Claude interaja com tarefas, projetos, usuários e registro de horas diretamente via ferramentas MCP.

Vive dentro do repositório `mai` (`mcp/servers/runrunit/`), baseado em
https://github.com/mariombn/mcp-server-runrunit. Instalado via `mcp/runrunit.json` +
`../../../install.sh`, não editando `settings.json` manualmente.
API docs: https://runrun.it/api/documentation
API doc Markdown: `./doc/api.md` (Usar essa de preferencia)

## Stack

- **TypeScript** (strict mode, ESNext + NodeNext modules)
- **@modelcontextprotocol/sdk** — SDK oficial do MCP
- **t3-env + zod** — validação de variáveis de ambiente
- **Native fetch** do Node.js — sem axios ou node-fetch
- **tsx** para dev, `tsc` para build

## Comandos

```bash
npm install
npm run dev      # roda direto com tsx (desenvolvimento)
npm run build    # compila para ./build
npm run start    # roda o build compilado
```

## Autenticação

A API do Runrun.it usa dois headers obrigatórios em todas as requisições:

```
App-Key: <app_key_da_empresa>
User-Token: <token_do_usuario>
```

Configurados via `.env` **na raiz do repositório `mai`** (não nesta pasta — veja `../../../.env.example`):
```
RUNRUNIT_APP_KEY=...
RUNRUNIT_USER_TOKEN=...
```

O `src/env.ts` valida essas variáveis com zod via `t3-env`, carregando o `.env` a partir da
própria localização do arquivo (`import.meta.url`), subindo 4 níveis até a raiz do `mai` — não
de `process.cwd()`, necessário porque o Claude Code inicia este processo com um cwd arbitrário.
Nunca acessar `process.env` diretamente — sempre importar de `./env.js`. As credenciais nunca são
gravadas em nenhum `settings.json`/`.mcp.json` pelo instalador do `mai`.

## Arquitetura

```
src/
├── index.ts          # Entry point: instancia server, agrega tools, conecta transport
├── env.ts            # Validação de env vars (t3-env + zod)
├── client.ts         # runrunitFetch() + interfaces TypeScript da API
├── cache.ts          # cache em disco (TTL 1h) pra dados de referência
├── preferences.ts    # preferências por usuário (sem TTL) — ex: projeto preferido
└── tools/
    ├── tasks.ts      # get_task, get_task_details, list_tasks, create/update_task, assign_task_user, change_task_board
    ├── projects.ts   # list_projects (cacheado)
    ├── boards.ts     # list_board_stages (cacheado)
    ├── users.ts      # get_me, list_users, list_teams (cacheados)
    ├── time.ts       # create_time_entry, list_time_entries
    └── excel.ts      # export_to_excel

tests/
├── client.test.ts
├── cache.test.ts
└── tools/
    ├── tasks.test.ts
    ├── projects.test.ts
    ├── boards.test.ts
    ├── users.test.ts
    └── time.test.ts
```

## Ferramentas implementadas

| Tool | Módulo | Descrição |
|------|--------|-----------|
| `get_task` | tasks | Busca task por ID com descrição separada |
| `get_task_details` | tasks | Resposta bruta da API (para debug/campos técnicos) |
| `list_tasks` | tasks | Lista tasks com filtros: responsible_id, project_id, team_id, is_closed, board_stage_id, overdue, parent_task_id (subtasks), completed_since/before, sort_by, page, limit |
| `create_task` | tasks | Cria nova task (obrig: title, project_id). Aceita `board_stage_id`, `type_id`, `custom_fields` — sem `board_stage_id` a task cai no board padrão da conta, não no board do projeto. `parent_task_id` cria como subtask real |
| `update_task` | tasks | Atualiza task existente (obrig: id). Aceita `custom_fields` |
| `update_task_description` | tasks | Atualiza o texto/corpo da descrição de uma task |
| `assign_task_user` | tasks | Adiciona um responsável (assignment) a uma task (obrig: task_id, assignee_id) |
| `change_task_board` | tasks | Move uma task para outro board (obrig: task_id, board_id) |
| `list_projects` † | projects | Lista projetos disponíveis, incluindo `board_id`/`type_id` de cada um |
| `get_preferred_project` ‡ | projects | Retorna o projeto que este usuário fixou como padrão (ou `null`) |
| `set_preferred_project` ‡ | projects | Fixa um projeto (e opcionalmente seu board) como padrão deste usuário (obrig: project_id, project_name; opcional: board_id, board_name). Re-fixar o mesmo project_id sem board mantém o board já fixado; trocar de projeto descarta o board anterior |
| `clear_preferred_project` ‡ | projects | Remove o projeto preferido deste usuário |
| `list_board_stages` † | boards | Lista as stages (colunas) de um board (obrig: board_id) — usar o `board_id` de `list_projects` pra achar o `board_stage_id` certo antes de criar uma task |
| `get_me` † | users | Dados do usuário autenticado |
| `list_users` † | users | Lista usuários do time (filtros: team_id, limit) |
| `list_teams` † | users | Lista times, com membros e board |
| `create_time_entry` | time | Registra horas em uma task (obrig: task_id, amount, date) |
| `list_time_entries` | time | Lista horas registradas (filtros: task_id, user_id, start_date, end_date, limit) |
| `export_to_excel` | excel | Gera um .xlsx a partir de dados estruturados (obrig: sheets) |

† Cacheado em disco por 1h via `src/cache.ts` (`.cache/`, namespaced por hash da
App-Key) — aceita `force_refresh: true` pra ignorar. Nunca usar cache pra tasks
(mudam de status/tempo o tempo todo) — só pra listas de referência.

‡ Persistido sem TTL via `src/preferences.ts` (`.cache/<hash-app-key>/users/<hash-user-token>/preferred-project.json`)
— namespaced por App-Key **e** User-Token, já que o App-Key é compartilhado por
todo mundo na mesma conta Runrun.it mas o User-Token é individual; sem isso,
dois usuários da mesma conta pisariam no projeto preferido um do outro.

### Observações sobre a API

- `responsible_id` / `user_id` são **string slugs** (ex: `"mario-neto"`), não inteiros
- `project_id`, `team_id`, `board_stage_id`, `parent_task_id` são **numéricos**
- `amount` em time entries é em **segundos** (ex: 3600 = 1h)
- `current_estimate_seconds` é o campo de estimativa de tasks
- Subtasks são tasks reais (`parent_task_id` no create, filtro no list_tasks, campo
  `subtask_ids` no retorno de `get_task`/`list_tasks`) — não itens de checklist
- **`create_task` sem `board_stage_id` não herda o board do projeto** — a API do
  Runrun.it coloca a task no board padrão da conta (ex: um board de intake de outro
  time). Sempre resolver `board_id` via `list_projects` → `list_board_stages(board_id)`
  → passar o `board_stage_id` escolhido em `create_task`
- `custom_fields` (ex: Produto, Sistema, Tipo de solicitação, Equipe) não têm endpoint
  de definição/schema na API — a forma prática de descobrir valores válidos pra um
  projeto é olhar o `custom_fields` de uma task-irmã existente via `get_task_details`
  e copiar a forma/valores
- **Cuidado**: uma task-irmã pode exibir valores em campos que já foram **desativados**
  no board (confirmado num board real — detalhes em `$MAI_ROOT/.private/context.md`, se existir) —
  `get_task_details` continua mostrando o valor histórico normalmente, mas um `PUT
  /tasks/:id` tentando escrever nesse campo em outra task do mesmo board retorna `422
  "O campo 'X' está inativo no quadro da tarefa e seu valor não pode ser atualizado."`.
  Isso vale campo a campo — testar um por vez (ou tentar todos e remover os que
  falharem) em vez de assumir que o conjunto inteiro da task-irmã ainda é válido hoje.
- `list_projects` **nunca retorna `board_id`/`type_id` de verdade** — mesmo a doc
  oficial da API mistura params de request com campos de response nessa tabela; o
  `GET /projects` real não devolve esses campos por projeto (confirmado batendo direto
  na API). Continuar usando o fallback já documentado (task-irmã via `get_task_details`)
  pra descobrir o board de um projeto — nunca confiar em `board_id`/`type_id` vindo de
  `list_projects`
- Mesmo com um `board_stage_id` válido (confirmado via `list_board_stages`) e o
  `board_id` certo, `create_task` pode devolver `422 "A etapa deve pertencer a este
  quadro"` pra alguns projetos (confirmado num projeto real — detalhes em
  `$MAI_ROOT/.private/context.md`, se existir) — a API parece resolver "o board deste projeto" de um jeito que
  não bate com o `board_id` que as tasks existentes mostram, mesmo sem nenhum problema
  aparente nos IDs. **Sequência que funciona sempre** (confirmada na prática):
  1. `create_task` **mínimo** — só `title`, `project_id`, `type_id`, `team_id`. Não
     passar `board_stage_id`, `custom_fields` nem `responsible_id` nessa chamada: a task
     cai no board padrão da conta (ex: um board de intake de outro time, tipo
     "Tarefas do Marketing"), e esse board padrão normalmente **não tem os mesmos
     custom fields** do board real do projeto (gera `422 "O campo 'X' não pertence ao
     quadro da tarefa"` se você tentar), e o responsável pretendido pode **não ter
     autorização nesse board** (gera `422 "user_not_authorized"`) mesmo tendo
     autorização no board certo.
  2. `change_task_board(task_id, board_id)` pro `board_id` certo do projeto — isso já
     move a task pra stage padrão do board (tipo Backlog).
  3. `update_task` com `custom_fields` (e `board_stage_id` só se precisar de uma stage
     diferente da padrão) — agora funciona porque a task já está no board certo.
  4. Responsável: usar `assign_task_user(task_id, assignee_id, team_id)`, não
     `update_task` com `responsible_id` — confirmado que `update_task` aceita o campo
     sem erro (200 OK) mas o `responsible_id` da task continua `null` depois; só
     `assign_task_user` realmente atribui.
  5. `update_task_description` por último, como já era.
- `update_task_description` espera `{"description": "<html ou texto>"}` (string direta,
  não `{"description": {"body": "..."}}`) — a doc oficial documenta
  `description[body]*`, mas isso está errado: nesse formato a API aceita a requisição
  (200 OK) e mexe no `edited_at`, só que o conteúdo nunca é salvo (fica `null`/vazio)
- **`task[desired_date]` (prazo/vencimento da task) não persiste via `PUT /tasks/:id`**,
  apesar de documentado (`doc/api.md` linhas 992-997) — confirmado na prática: um `PUT`
  só com `desired_date` retorna `400 Bad Request` ("Bad Request" genérico, sem
  `errors[]`); combinado com outro campo (ex: `is_urgent`) o `PUT` retorna `200 OK`, mas
  o campo continua `null` depois (confirmado via `get_task_details`). O antigo campo
  exposto pelo tool (`estimated_delivery_date`) tem o mesmo problema, mas por outro
  motivo: não é sequer um parâmetro de escrita documentado — é um campo calculado pela
  fila/estimativa (`estimated_delivery_date_updated`, `last_estimated_at`), então
  aceitar esse nome como input do tool sempre foi um bug (corrigido — o tool agora
  expõe `desired_date`, que ao menos bate com o nome real da API, mesmo não persistindo
  hoje). Não foi encontrada nenhuma variação de formato de data (`YYYY-MM-DD`, ISO com
  timezone, ISO UTC) que faça `desired_date` persistir. Até isso ser investigado mais a
  fundo (ou confirmado como limitação da conta/board), definir prazo de task **precisa
  ser feito manualmente na UI do Runrun.it** — avisar o usuário nesse caso em vez de
  reportar sucesso silencioso.
- **`task[is_urgent]` via `PUT /tasks/:id` também não persistiu** num teste isolado
  (retornou `200 OK`, mas `get_task_details` seguinte mostrou `is_urgent: false` de
  novo) — mesma classe de problema do item acima. Ainda não testado a fundo (pode ser
  específico da conta/board, ou precisar de outro campo junto); tratar como suspeito
  até confirmar, e sempre validar com `get_task_details` depois de tentar mudar
  `is_urgent`/`desired_date` via `update_task`.
- **`GET /tasks?parent_task_id=X` é ignorado silenciosamente pela API** — apesar de
  documentado, o filtro não é aplicado: a resposta traz tasks de projetos totalmente
  não relacionados (confirmado batendo direto na API). Por isso `list_tasks` não manda
  mais `parent_task_id` na query string — quando esse filtro é passado, ele resolve a
  árvore de descendentes localmente (BFS via `subtask_ids`, que é confiável no retorno
  de `GET /tasks/:id`) e aplica os demais filtros (`board_stage_id`, `project_id`,
  `team_id`, `is_closed`, `responsible_id`, `overdue`) client-side sobre esse conjunto.
  Ver `fetchDescendantTasks`/`matchesTaskFilters` em `src/tools/tasks.ts`.

## Convenções de código

- Nunca usar `any` — definir interfaces para respostas da API em `client.ts`
- Cada arquivo em `tools/` exporta: `toolDefinitions` (array de schemas) + `handleTool(name, args)` (handler)
- `index.ts` agrega os `toolDefinitions` de todos os módulos e faz dispatch para os handlers
- Handlers lançam exceção em caso de erro — `index.ts` captura e retorna `{ content, isError: true }`
- Helpers `simplify*()` transformam respostas brutas da API em formato legível pelo modelo

## Configuração no Claude Code

Não editar `settings.json`/`.mcp.json` manualmente. O fragmento `../../runrunit.json` (relativo
à raiz do `mai`) descreve a entrada `mcpServers.runrunit` apontando para
`mcp/servers/runrunit/build/index.js` via caminho absoluto (`${MAI_ROOT}`, resolvido pelo
instalador); `../../../install.sh` faz o merge idempotente nesse arquivo. Ver
`mai/README.md` para o fluxo completo.
