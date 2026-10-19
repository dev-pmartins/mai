---
name: gmud
description: Gera a documentação de uma GMUD (Gestão de Mudança) de uma aplicação a partir da diferença entre duas branches do repositório local — levanta/reaproveita um cache por aplicação (linguagem, framework, versões, integrações com outros sistemas, onde entregar o relatório), confere se as branches estão atualizadas e commitadas, analisa impactos em pacotes, banco de dados (migrations/seeders) e variáveis de ambiente, faz um code review rápido em busca de riscos graves, e produz um relatório em Markdown (com plano de implantação e rollback) e, opcionalmente, um PDF não técnico. Use quando o usuário invocar /gmud ou pedir para criar/documentar uma GMUD.
---

Este skill documenta, de forma clara e sucinta, **o que muda no sistema** com uma entrega, para
que o revisor da GMUD entenda a mudança, seus riscos e como implantá-la/revertê-la sem precisar
ler o código.

**Sempre responda ao usuário em português (pt-BR)** — perguntas, análise, relatório e PDF.

**Nunca invente dados.** Versões, integrações, autores, comandos de migration — tudo vem do
repositório, do cache ou do usuário. Se algo não puder ser determinado, pergunte; se o usuário
optar por deixar em aberto, escreva explicitamente "não informado" no relatório.

**Só lê o repositório da aplicação.** Este skill não faz checkout, commit, push nem altera
arquivos da aplicação — a única escrita é no cache (Passo 1) e nos arquivos de saída (Passo 11).
Se uma branch estiver desatualizada ou com mudanças não commitadas, avise e deixe o usuário
resolver.

## Passo 0 — Identificar a aplicação

Rode no diretório atual (ou no caminho que o usuário indicar):

```bash
git rev-parse --show-toplevel
git remote get-url origin
```

Se não for um repositório git, pergunte ao usuário o caminho do repositório da aplicação.

A **chave da aplicação** é `<owner>__<repo>` extraída da URL do `origin`
(`git@github.com:acme/portal.git` → `acme__portal`). Sem `origin`, use o nome do
diretório raiz do repo e avise o usuário.

## Passo 1 — Cache da aplicação

Resolva a raiz do `mai` a partir do próprio local deste skill (instalado como symlink — dois
níveis acima de `skills/gmud`):

```bash
MAI_ROOT="$(dirname "$(dirname "$(realpath ~/.claude/skills/gmud 2>/dev/null || realpath .claude/skills/gmud)")")"
CACHE_DIR="$MAI_ROOT/.cache/gmud"   # .cache/ já é gitignored no mai
CACHE_FILE="$CACHE_DIR/<chave-da-aplicacao>.json"
```

Se a resolução falhar (instalação atípica), pergunte ao usuário onde fica o repo `mai`.

Se existir `$MAI_ROOT/.private/context.md` (contexto local da empresa, não versionado), leia-o —
pode trazer convenções úteis (onde ficam os clones, ferramenta de rastreio, stack padrão).

**Essa aplicação já teve uma GMUD anterior?** Se `CACHE_FILE` existir, leia-o e mostre um resumo
(stack, integrações, local de entrega, GMUDs anteriores) — o usuário confirma ou corrige antes de
seguir. Se não existir, avise que é a primeira GMUD dessa aplicação e que o cache será criado ao
longo dos próximos passos.

Formato do cache (crie com `mkdir -p "$CACHE_DIR"`; atualize sempre que um passo descobrir ou
corrigir algo, não só no final):

```json
{
  "app": { "key": "acme__portal", "name": "Portal", "remote": "git@github.com:...", "local_path": "/home/..." },
  "stack": {
    "language": "PHP", "language_version": "8.2",
    "framework": "Laravel", "framework_version": "10.48",
    "package_managers": ["composer", "npm"],
    "confirmed_at": "2026-10-19"
  },
  "context": {
    "summary": "O que o sistema faz e para quem.",
    "integrations": [ { "system": "Runrun.it", "how": "API REST de saída", "notes": "" } ],
    "knowledge_sources": ["link ou caminho de documentação usada"]
  },
  "delivery": { "report_dir": "/caminho/onde/entregar", "notes": "" },
  "gmuds": [
    {
      "head": "feature/x", "base": "master",
      "head_sha": "abc123", "base_sha": "def456",
      "card": "link do Runrun.it ou null",
      "report_path": "...", "pdf_path": null,
      "created_at": "2026-10-19", "updated_at": "2026-10-19"
    }
  ]
}
```

## Passo 2 — Linguagem, framework e versões

Não pergunte do zero: **detecte e peça confirmação**. Procure na raiz do repo os manifestos e
leia as versões de lá:

| Manifesto | O que extrair |
|---|---|
| `composer.json` / `composer.lock` | `require.php`, `laravel/framework` (ou outro framework), versão travada no lock |
| `package.json` / lockfile | `engines.node`, framework (`next`, `react`, `vue`, `@nestjs/core`, `express`...) |
| `.nvmrc`, `.node-version`, `.tool-versions`, `.php-version` | versão do runtime |
| `go.mod`, `requirements.txt`/`pyproject.toml`, `Gemfile`, `pom.xml`/`build.gradle` | equivalentes de cada ecossistema |
| `Dockerfile` / `docker-compose.yml` | imagem base (ex: `php:8.2-fpm`) — útil para confirmar a versão de runtime em produção |

Mostre o que foi detectado e peça confirmação. Se havia cache e a versão detectada **difere** do
cache, destaque isso — um upgrade de linguagem/framework é, por si só, um item relevante da GMUD.
Salve no cache (`stack`).

## Passo 3 — Contexto e integrações do sistema

Com cache: mostre `context` e pergunte se algo mudou (nova integração, sistema descontinuado).

Sem cache: pergunte primeiro se existe **alguma base de conhecimento** que possa ser usada como
fonte (README, wiki, Confluence/Notion, documento de arquitetura, card do Runrun.it). Se houver,
leia-a. Complemente com o próprio repo — `README*`, `config/services.php`, `.env.example`
(hosts/chaves de APIs externas), clients HTTP, filas, webhooks — e apresente um rascunho:

- O que o sistema faz e quem o usa.
- Com quais outros sistemas ele se comunica, e como (API de entrada/saída, fila, banco
  compartilhado, arquivos, webhook).

Faça perguntas até ter insumo suficiente para que o revisor da GMUD entenda **onde essa mudança
pode repercutir**. Salve no cache (`context`).

## Passo 4 — Branches a comparar

Se o cache já tiver uma GMUD para a branch atual (`git branch --show-current` igual a algum
`gmuds[].head`), proponha reaproveitar o mesmo par `base`/`head` — é uma reexecução da GMUD dessa
alteração. Caso contrário, pergunte quais branches comparar (sugira a branch atual como `head` e a
branch principal do repo como `base`).

Verifique, sem alterar nada:

```bash
git status --porcelain                         # há mudanças não commitadas?
git fetch origin --prune
git rev-parse <base> origin/<base>             # local == remoto?
git rev-parse <head> origin/<head>
git rev-list --left-right --count <base>...origin/<base>
git rev-list --left-right --count <head>...origin/<head>
```

Reporte ao usuário qualquer pendência (arquivos não commitados, branch atrás/à frente do remoto,
branch inexistente no remoto) e pergunte se quer resolver antes ou seguir assim mesmo — se seguir,
registre isso no relatório. Na primeira execução da GMUD dessa alteração, grave o par de branches
e os SHAs em `gmuds[]` no cache; numa reexecução, atualize os SHAs e `updated_at`.

A partir daqui, toda análise usa o diff `git diff <base>...<head>` (três pontos: só o que a
`head` introduz desde o ponto de divergência).

## Passo 5 — Card relacionado e condições extras

Pergunte, numa só mensagem:

1. Há um **card do Runrun.it** dessa tarefa? Se o usuário colar um link/ID, busque título,
   descrição e critérios de aceite com as ferramentas MCP `runrunit` (`get_task`,
   `get_task_description`). Se o MCP estiver indisponível, avise e peça um resumo em texto.
2. Existe **alguma outra condição ou detalhe** que deva ser considerado antes de gerar a GMUD?
   (janela de implantação, dependência de outra entrega, feature flag, comunicação a clientes,
   ação manual em produção...)

## Passo 6 — Visão geral do diff e autores

```bash
git diff --stat <base>...<head>
git diff --name-status <base>...<head>
git log --no-merges --format='%an <%ae>' <base>..<head> | sort | uniq -c | sort -rn
git log --no-merges --oneline <base>..<head>
```

Agrupe os arquivos alterados por categoria (de acordo com a stack do Passo 2) — ex. para Laravel:
Rotas/Controllers, Models, Migrations/Seeders, Services/Jobs/Events, Views, Config/env, Testes,
Outros. Os autores vêm do `git log` — não pergunte.

## Passo 7 — Impactos de infraestrutura

Com base na stack levantada, analise o diff destes três grupos. Para cada um, se não houver
alteração, registre "nenhuma alteração" — o revisor precisa saber que foi verificado.

### 7.1 Pacotes e bibliotecas

Arquivos de manifesto e lock (`composer.json/.lock`, `package.json` + lockfile, `go.mod/go.sum`,
`requirements*.txt`, etc.). Para cada pacote: **adicionado, removido ou alterado** com versão
antes → depois. Destaque mudanças de major version e pacotes que exigem passo extra na
implantação (extensão PHP nova, build de assets, `php artisan vendor:publish`, etc.).

### 7.2 Banco de dados

Migrations, seeders, factories usadas em seed, SQL avulso, alterações em schema/ORM (conforme o
framework: `database/migrations` e `database/seeders` no Laravel, `prisma/migrations`,
`alembic/versions`, `db/migrate`...). Para cada **migration**, descreva o que ela faz em
linguagem simples e avalie:

- é reversível (`down()` implementado e correto)?
- pode travar tabela grande, apagar dados, ou quebrar o código em produção durante a janela de
  deploy (coluna `NOT NULL` sem default, rename/drop de coluna ainda usada)?
- o comando para rodar **somente ela**, com o mínimo de impacto — ex. Laravel:
  `php artisan migrate --path=database/migrations/<arquivo>.php --force`
- o comando de rollback dela — ex. Laravel:
  `php artisan migrate:rollback --path=database/migrations/<arquivo>.php --force`

Para cada **seeder**: o que insere/altera, se é idempotente (rodar duas vezes duplica dados?), e
o comando isolado — ex. Laravel: `php artisan db:seed --class=<SeederClass> --force`.

Use sempre o equivalente correto da stack detectada; se não souber o comando isolado para aquele
framework/versão, consulte a documentação oficial da versão em vez de supor.

### 7.3 Variáveis de ambiente

Diff de `.env.example`/`.env.*.example`, arquivos de config (`config/*.php`, `config/*.ts`...),
e usos novos de `env(...)`, `process.env.X`, `os.getenv(...)` etc. no código alterado. Para cada
variável **nova, alterada ou removida**: nome, para que serve, valor esperado/formato (nunca
copie valores reais de segredos), se é obrigatória, e qual o comportamento se estiver ausente.
Lembre também de comandos de cache de config quando a stack exigir (ex. `php artisan config:cache`).

## Passo 8 — Code review rápido

Uma passada curta pelo diff focada **apenas no que é crítico ou danoso** — não é uma revisão
completa (para isso existe o `/review`). Procure:

- perda ou corrupção de dados (delete/update sem `where`, migrations destrutivas);
- falhas de segurança (SQL injection, falta de autorização, segredo commitado, dado sensível em
  log/resposta);
- algo que derrube a aplicação na implantação (classe/arquivo referenciado e inexistente, env
  obrigatória sem fallback, quebra de contrato com um dos sistemas integrados do Passo 3);
- código de debug esquecido (`dd()`, `dump()`, `console.log` com dados, `var_dump`).

Se a stack for Laravel e o diff for grande, pode delegar essa passada ao agente
`revisor-laravel`, pedindo explicitamente só achados críticos.

**Se encontrar algo grave, pare e pergunte** antes de gerar o relatório: mostre o achado
(arquivo, trecho, por que é grave) e pergunte se o usuário quer corrigir antes ou seguir com a
GMUD documentando o risco. Achados graves mantidos entram na seção **Riscos** com o contexto e o
porquê da gravidade.

## Passo 9 — Destino da entrega

Com cache e `delivery.report_dir` preenchido: confirme se a entrega continua no mesmo lugar.
Sem cache: pergunte ao usuário **onde o relatório deve ser entregue** (um diretório local, uma
pasta sincronizada, etc.). Salve o caminho em `delivery.report_dir` para as próximas GMUDs.
Se o caminho estiver dentro do repo `mai` (fora de `.cache/` ou `.private/`), avise e peça outro:
os relatórios descrevem sistemas da empresa e não podem acabar versionados no `mai`.

Pergunte também se deve ser gerado um **PDF não técnico** sobre as alterações (para gestores /
áreas de negócio).

## Passo 10 — Relatório (Markdown)

Monte o relatório no formato abaixo. Seções marcadas como condicionais só entram se houver
conteúdo; nas demais, escreva "Nenhuma alteração" quando for o caso. Seja sucinto: o revisor
deve entender a mudança em poucos minutos.

```markdown
# GMUD — <título curto da mudança>

**Aplicação:** <nome> · **Branches:** `<base>` ← `<head>` (`<base_sha curto>`..`<head_sha curto>`) · **Data:** <data>
**Card relacionado:** <link do Runrun.it>            ← condicional

## Breve descrição
<2–4 frases: o que muda e por quê, na linguagem do negócio.>

## Riscos                                            ← condicional (só riscos consideráveis)
- **<risco>** — <contexto, por que é grave, mitigação>

## Autores envolvidos
- <Nome> <email> — <n> commits

## Pacotes adicionados/alterados
| Pacote | Antes | Depois | Observação |

## Novas variáveis de ambiente
| Variável | Descrição | Obrigatória | Exemplo/formato |

## Novas migrations
- `<arquivo>` — <o que faz>. Executar: `<comando isolado>`. Rollback: `<comando>`.

## Novos seeders
- `<Classe>` — <o que faz, idempotente?>. Executar: `<comando isolado>`.

## Passos de implantação
1. <ordem: pacotes → env → migrations → seeders → caches/build → restart de workers/filas>

## Plano de rollback
1. <como reverter código, migrations, seeders (dados inseridos) e env vars>

## Detalhamento das alterações
<por área/categoria do Passo 6: o que mudou e qual o efeito no sistema e nas integrações.>

## Conclusão
<avaliação geral: tamanho/risco da mudança, pré-requisitos, pendências registradas no Passo 4.>
```

Pode adaptar a estrutura quando ajudar a clareza (ex.: juntar seções vazias numa linha), mas
mantenha a ordem e não omita Passos de implantação e Plano de rollback.

Mostre o relatório ao usuário e peça validação/ajustes antes de gravar os arquivos.

## Passo 11 — Gravar a entrega e atualizar o cache

1. Grave o Markdown em `<delivery.report_dir>/gmud-<app>-<head-sanitizada>-<AAAA-MM-DD>.md`
   (sanitize `/` da branch para `-`). Se o arquivo já existir (reexecução), mostre ao usuário e
   pergunte se sobrescreve.
2. Se o usuário pediu o **PDF não técnico**: escreva uma versão curta (1–2 páginas) sem jargão —
   o que muda para quem usa o sistema, benefício, impacto/indisponibilidade esperada, riscos em
   linguagem simples, quem contatar. Nada de nomes de arquivos, pacotes ou comandos. Gere o PDF
   usando o skill `anthropic-skills:pdf` e grave ao lado do Markdown com o mesmo nome base e
   sufixo `-resumo.pdf`.
3. Atualize a entrada em `gmuds[]` no cache com `report_path`, `pdf_path`, `card` e `updated_at`.

Finalize informando os caminhos absolutos dos arquivos gerados e do cache atualizado.
