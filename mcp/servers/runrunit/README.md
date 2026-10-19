# mcp-server-runrunit

Servidor MCP ([Model Context Protocol](https://modelcontextprotocol.io)) para integração com a API do [Runrun.it](https://runrun.it). Permite que o Claude interaja com tarefas, usuários e projetos do Runrun.it diretamente via ferramentas MCP.

Vive dentro do repositório [`mai`](../../../README.md) como `mcp/servers/runrunit/` — baseado em
[`mariombn/mcp-server-runrunit`](https://github.com/mariombn/mcp-server-runrunit).
A instalação normal (symlink no `.mcp.json`/`settings.json` do destino) é feita pelo
`./install.sh` da raiz do `mai`, via o fragmento `mcp/runrunit.json` — não é necessário editar
`settings.json` manualmente. Esta página documenta o servidor em si: como buildar, testar e
quais ferramentas ele expõe.

- API docs: https://runrun.it/api/documentation

## Ferramentas disponíveis

| Tool | Descrição |
|------|-----------|
| `get_task` | Busca informações de uma task por ID (título, descrição, status, responsável etc.) |
| `get_task_details` | Retorna a resposta bruta completa da API para uma task (útil para campos técnicos) |
| `get_task_description` | Retorna os detalhes da descrição de uma task (texto, usuário atual editando, datas) |
| `list_tasks` | Lista tasks com filtros opcionais, incluindo `parent_task_id` pra listar subtasks |
| `create_task` | Cria uma nova task — passando `parent_task_id`, cria como subtask real de outra task |
| `update_task` | Atualiza uma task existente |
| `update_task_description` | Atualiza o texto/corpo da descrição de uma task |
| `assign_task_user` | Adiciona um responsável (assignment) a uma task |
| `change_task_board` | Move uma task para outro board |
| `list_projects` † | Lista os projetos disponíveis, incluindo `board_id`/`type_id` de cada um |
| `get_preferred_project` ‡ | Retorna o projeto que este usuário fixou como padrão (ou `null`) |
| `set_preferred_project` ‡ | Fixa um projeto (e opcionalmente seu board) como padrão deste usuário (obrig: `project_id`, `project_name`; opcional: `board_id`, `board_name`) |
| `clear_preferred_project` ‡ | Remove o projeto preferido deste usuário |
| `list_board_stages` † | Lista as stages (colunas) de um board — ver nota abaixo sobre `board_stage_id` em `create_task` |
| `get_me` † | Retorna os dados do usuário autenticado |
| `list_users` † | Lista usuários da organização |
| `list_teams` † | Lista os times da organização, com membros e board |
| `create_time_entry` | Registra horas trabalhadas em uma task |
| `list_time_entries` | Lista horas registradas com filtros opcionais |
| `export_to_excel` | Gera um `.xlsx` a partir de dados estruturados (não é específico do Runrun.it) |

† **Dados de referência com cache em disco de 1h** (`mcp/servers/runrunit/.cache/`,
namespaced por hash da App-Key — nunca cacheia tasks, que mudam o tempo todo). Passe
`force_refresh: true` pra ignorar o cache numa chamada específica. Ver `src/cache.ts`.

‡ **Preferência por usuário, persistida sem TTL** em
`.cache/<hash-app-key>/users/<hash-user-token>/preferred-project.json` — namespaced
também pelo User-Token (não só pela App-Key) pra que dois usuários da mesma conta
Runrun.it não sobrescrevam o projeto preferido um do outro. Ver `src/preferences.ts`.

### Filtros e parâmetros por tool

**`list_tasks`**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `responsible_id` | string | Slug do responsável (ex: `"mario-neto"`) |
| `project_id` | number | ID do projeto |
| `team_id` | number | ID do time |
| `is_closed` | boolean | Filtrar por tasks fechadas |
| `sort_by` | string | Campo de ordenação (ex: `"created_at"`) |
| `page` | number | Página para paginação |
| `limit` | number | Quantidade de tasks (máx. 100) |

**`create_task`** — obrigatórios: `title`, `project_id`

> ⚠️ **Sem `board_stage_id`, a task NÃO herda o board do projeto** — a API do
> Runrun.it a coloca no board padrão da conta (que pode ser o de outro time, ex.
> Marketing). Antes de criar, chame `list_projects` pra pegar o `board_id` do
> projeto, depois `list_board_stages(board_id)` pra escolher um `board_stage_id`
> válido. Para `custom_fields` (Produto, Sistema, Tipo de solicitação, Equipe etc.),
> não há endpoint de schema — copie a forma/valores do `custom_fields` de uma task
> já existente no mesmo projeto (via `get_task_details`).

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `title` | string | Título da task |
| `project_id` | number | ID do projeto |
| `board_stage_id` | number | ID da stage (coluna do board) — ver aviso acima |
| `type_id` | number | ID do tipo da task |
| `custom_fields` | object | Campos customizados da task (ver aviso acima) |
| `responsible_id` | string | Slug do responsável |
| `team_id` | number | ID do time |
| `estimated_delivery_date` | string | Data no formato `YYYY-MM-DD` |
| `current_estimate_seconds` | number | Estimativa em segundos (ex: 3600 = 1h) |
| `is_urgent` | boolean | Marcar como urgente |
| `parent_task_id` | number | ID da task-mãe — cria esta como subtask real dela |

**`update_task`** — obrigatório: `id` — aceita qualquer combinação dos campos de `create_task` + `is_closed`, `points`

**`assign_task_user`** — obrigatórios: `task_id`, `assignee_id`

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `task_id` | number | ID da task |
| `assignee_id` | string | Slug do usuário a ser adicionado como responsável |
| `team_id` | number | ID do time |

**`change_task_board`** — obrigatórios: `task_id`, `board_id`

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `task_id` | number | ID da task |
| `board_id` | number | ID do board de destino |

**`get_task_description`** — obrigatório: `task_id`

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `task_id` | number | ID da task |

**`update_task_description`** — obrigatórios: `task_id`, `body`

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `task_id` | number | ID da task |
| `body` | string | Substitui o corpo da descrição da task |

**`list_projects`** (cacheado, ver nota † acima)

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `limit` | number | Quantidade de projetos |
| `page` | number | Página para paginação |
| `force_refresh` | boolean | Ignora o cache e busca da API |

**`list_board_stages`** (cacheado, ver nota † acima) — obrigatório: `board_id`

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `board_id` | number | ID do board (vem do `board_id` retornado por `list_projects`) |
| `stage_group` | string | Filtrar por `'opened'` ou `'closed'` |
| `force_refresh` | boolean | Ignora o cache e busca da API |

**`list_users`** (cacheado, ver nota † acima)

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `team_id` | number | Filtrar por time |
| `limit` | number | Quantidade de usuários |
| `force_refresh` | boolean | Ignora o cache e busca da API |

**`list_teams`** (cacheado, ver nota † acima) — sem parâmetros, exceto `force_refresh`

**`create_time_entry`** — obrigatórios: `task_id`, `amount`, `date`

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `task_id` | number | ID da task |
| `amount` | number | Tempo em segundos (ex: 3600 = 1h) |
| `date` | string | Data no formato `YYYY-MM-DD` |
| `description` | string | Descrição do trabalho realizado |

**`list_time_entries`**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `task_id` | number | Filtrar por task |
| `user_id` | string | Filtrar por usuário (slug) |
| `start_date` | string | Data inicial `YYYY-MM-DD` |
| `end_date` | string | Data final `YYYY-MM-DD` |
| `limit` | number | Quantidade de registros |

## Pré-requisitos

- Node.js 18+
- Credenciais da API do Runrun.it: **App Key** e **User Token**
  - Acesse **Configurações → Integrações → API** no Runrun.it para obter suas credenciais

## Setup

```bash
cd mcp/servers/runrunit
npm install
npm run build   # necessário: o fragmento mcp/runrunit.json aponta pro build compilado
```

Crie o arquivo `.env` **na raiz do `mai`** (não nesta pasta — veja `../../../.env.example`):

```env
RUNRUNIT_APP_KEY=sua_app_key
RUNRUNIT_USER_TOKEN=seu_user_token
```

`src/env.ts` carrega esse `.env` a partir da própria localização do arquivo, subindo até a raiz
do `mai` (não do `cwd` do processo), então funciona independente de onde o Claude Code foi
iniciado. As credenciais nunca são escritas em nenhum `settings.json`/`.mcp.json` — só existem
neste `.env` na raiz do repo, que é ignorado pelo git.

## Uso junto ao Claude Code

Depois do setup acima, rode o instalador na raiz do `mai`:

```bash
../../../install.sh --tool claude --scope global   # ou --scope project --project-dir <repo>
```

Isso cria/atualiza a entrada `runrunit` em `mcpServers` apontando para
`mcp/servers/runrunit/build/index.js` via caminho absoluto — sem precisar editar `settings.json`
à mão. Reinicie o Claude Code e confira com `/mcp` que o servidor `runrunit` está conectado.

### Uso em conversas

O Claude pode usar as ferramentas automaticamente conforme necessário. Você também pode
solicitá-las diretamente:

```
Liste as tasks abertas do projeto X
```
```
Mostre os detalhes da task 1234
```
```
Quais tasks estão atribuídas a mim?
```

### Modo desenvolvimento

Para rodar direto da fonte TypeScript sem build (`tsx`), aponte manualmente um `.mcp.json` local
para `npm run dev` em vez de usar o fragmento gerado pelo instalador — útil só durante o
desenvolvimento deste servidor, não para uso normal.

## Desenvolvimento

```bash
npm run dev          # roda direto com tsx (sem build)
npm run build        # compila para ./build
npm test             # roda os testes
npm run test:watch   # testes em modo watch
npm run test:coverage  # cobertura de código
```

### Estrutura do projeto

```
src/
├── index.ts          # Entry point: instancia o server, agrega tools, conecta transport
├── env.ts            # Validação de variáveis de ambiente (t3-env + zod)
├── client.ts         # runrunitFetch() + interfaces TypeScript da API
├── cache.ts          # cache em disco (TTL 1h) pra dados de referência
├── preferences.ts    # preferências por usuário (sem TTL) — ex: projeto preferido
└── tools/
    ├── tasks.ts      # get_task(s), create/update_task, task_descriptions, assign/change_board
    ├── users.ts      # get_me, list_users, list_teams (cacheados)
    ├── projects.ts   # list_projects (cacheado), get/set/clear_preferred_project
    ├── boards.ts     # list_board_stages (cacheado)
    ├── time.ts       # create_time_entry, list_time_entries
    └── excel.ts      # export_to_excel

tests/
├── client.test.ts
├── cache.test.ts
├── preferences.test.ts
└── tools/
    ├── tasks.test.ts
    ├── projects.test.ts
    ├── boards.test.ts
    ├── users.test.ts
    └── time.test.ts
```

### Stack

- **TypeScript** (strict mode, ESNext + NodeNext modules)
- **@modelcontextprotocol/sdk** — SDK oficial do MCP
- **t3-env + zod** — validação de variáveis de ambiente
- **Fetch nativo** do Node.js — sem axios ou node-fetch
- **Vitest** — testes unitários
- **tsx** para dev, `tsc` para build
