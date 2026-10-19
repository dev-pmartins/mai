---
name: review
description: Revisa um Pull Request do GitHub a partir do link — antes de tudo, exige contexto da tarefa (descrição do usuário ou link de um card do Runrun.it) — busca o diff via API, detecta a versão de PHP/Laravel e dependências relevantes a partir do composer.json do commit do PR, e conduz uma revisão de código contextualizada nessa stack (lógica de negócio, segurança, performance, convenções do framework, migrations, testes). Produz um relatório de achados e espera validação explícita antes de considerar a revisão concluída — nunca posta nada no GitHub, a submissão é sempre manual. Use quando o usuário invocar /review ou passar um link de PR do GitHub para revisão.
---

Este skill revisa um Pull Request do GitHub dado o seu link, usando a API REST do GitHub
(`curl` + `jq` — nenhuma dependência nova) para buscar diff e arquivos de manifesto, sem
precisar de um clone local do repositório.

**Nunca escreve no GitHub.** Este skill só lê (PR, diffs, conteúdo de arquivos) e entrega um
relatório. Publicar comentários/approve no PR é sempre uma ação manual do usuário — não ofereça
fazer isso automaticamente, mesmo se o usuário aprovar todos os achados.

**Sempre responda ao usuário em português (pt-BR)** — análise, tabelas, relatório final. Estas
instruções estão em inglês/português técnico só para clareza do modelo.

**Nunca invente dados.** Se o `GITHUB_TOKEN` estiver ausente/inválido, se o link não puder ser
resolvido, ou se a API retornar 404/403 (repo privado sem acesso, PR inexistente), pare e explique
o problema ao usuário em vez de seguir com informação incompleta ou suposta.

## Passo 1 — Contexto da tarefa (obrigatório)

Antes de qualquer chamada ao GitHub, esta etapa é **obrigatória** e bloqueia o restante do fluxo.
Pergunte ao usuário — se ele já não tiver fornecido isso junto com o link do PR — um dos dois:

- **Contexto da tarefa**: o que esse PR resolve, qual o problema/motivação, critérios de aceite; ou
- **Link de um card do Runrun.it** que descreva a tarefa (o time rastreia o trabalho lá).

Se o usuário colar um link/ID de card do Runrun.it, use as ferramentas MCP `runrunit`
(`get_task`, `get_task_description`, `get_task_details`) pra buscar título, descrição e critérios
de aceite do card, e leve isso para a análise de lógica de negócio no Passo 7.

Não avance para o Passo 2 sem uma dessas duas respostas. Se o usuário pedir explicitamente pra
pular essa etapa, respeite, mas avise que a revisão de lógica de negócio ficará mais rasa sem esse
contexto (o diff sozinho não conta a intenção por trás da mudança).

## Passo 2 — Credenciais

Resolva a raiz do repo `mai` a partir do próprio local deste skill (ele é instalado como symlink
— `readlink -f`/`realpath` no diretório do skill sobe até a raiz real do `mai`, dois níveis acima
de `skills/review`). Depois:

```bash
MAI_ROOT="$(dirname "$(dirname "$(realpath ~/.claude/skills/review 2>/dev/null || realpath .claude/skills/review)")")"
set -a; source "$MAI_ROOT/.env"; set +a
```

Se isso falhar (instalação atípica) ou `GITHUB_TOKEN` continuar vazio, pergunte ao usuário onde
fica o `.env` do `mai`, ou peça o token diretamente — nunca prossiga sem ele contra um repo
privado.

## Passo 3 — Resolver o link

Extraia `owner`, `repo` e `pr_number` de um link como
`https://github.com/{owner}/{repo}/pull/{pr_number}`. Se o usuário passar só `owner/repo#123` ou
um número (com repo já conhecido de uma interação anterior na mesma conversa), aceite também — mas
se faltar informação (qual repo, por exemplo), pergunte em vez de assumir.

## Passo 4 — Buscar o PR

```bash
curl -sS -H "Authorization: Bearer $GITHUB_TOKEN" -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$OWNER/$REPO/pulls/$PR_NUMBER"
```

Extraia: `title`, `body`, `state`, `draft`, `base.ref`/`base.sha`, `head.ref`/`head.sha`,
`user.login`, `additions`/`deletions`/`changed_files`.

Se `draft: true`, avise o usuário e pergunte se quer revisar mesmo assim (a lógica ainda pode
estar incompleta).

## Passo 5 — Buscar arquivos alterados

```bash
curl -sS -H "Authorization: Bearer $GITHUB_TOKEN" -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$OWNER/$REPO/pulls/$PR_NUMBER/files?per_page=100&page=1"
```

Pagine (`page=2`, `3`, ...) enquanto a resposta tiver 100 itens. Cada item traz `filename`,
`status` (added/modified/removed/renamed), `additions`, `deletions`, e `patch` (o hunk de diff) —
**a API omite `patch` para arquivos muito grandes** (arquivo binário ou diff enorme); nesse caso,
anote no relatório que esse arquivo precisa de revisão manual em vez de tentar reconstruir o diff.

Agrupe os arquivos por categoria, como no `revisor-laravel`: Controllers/Routes,
Models/Migrations, Services/Jobs/Events, Views/Blade, Testes, Configurações (`.env.example`,
`composer.json`), Outros. Se o PR tiver muitos arquivos (ex: >15), mostre essa contagem por
categoria e pergunte se o usuário quer revisar tudo ou focar em algum subconjunto — se for
pequeno, não precisa perguntar, siga direto.

## Passo 6 — Detectar a stack e as versões

Busque o `composer.json` no commit do PR (mesmo que ele não esteja entre os arquivos alterados —
o objetivo é saber a stack do projeto, não só o que mudou):

```bash
curl -sS -H "Authorization: Bearer $GITHUB_TOKEN" -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$OWNER/$REPO/contents/composer.json?ref=$HEAD_SHA" \
  | jq -r '.content' | base64 -d
```

Do `composer.json`, extraia:
- Versão do PHP exigida (`require.php`)
- Versão do Laravel (`require."laravel/framework"`)
- Pacotes relevantes que mudam o comportamento da revisão: `laravel/sanctum`,
  `laravel/passport`, `laravel/horizon`, `laravel/telescope`, `spatie/*`, SDKs de
  pagamento/AWS, etc.

Se o PR alterar `composer.json`/`composer.lock`, compare a versão antes/depois desses pacotes
(via `contents?ref=$BASE_SHA`) e destaque upgrades/downgrades de major/minor version — são um
ponto de atenção por si só (breaking changes, deprecations).

Se não houver `composer.json` (projeto não-PHP), avise o usuário que este skill foi desenhado
para a stack Laravel/PHP e que a revisão seguirá só com as dimensões genéricas (lógica,
segurança, performance, testes) — sem o contexto de versão de framework.

Use a versão detectada para embasar toda a análise seguinte — ao afirmar algo sobre comportamento
do framework, prefira consultar a documentação oficial da versão exata via WebFetch/WebSearch em
vez de assumir pela versão mais recente.

**Enriquecimento opcional:** se o repositório também estiver clonado localmente (a convenção de
diretório dos clones, quando houver, fica em `$MAI_ROOT/.private/context.md` — arquivo local,
não versionado; se não existir, pergunte ao usuário), pode usar `Read`/`Grep` nesse clone pra
aprofundar contexto — código não alterado ao redor do diff, testes existentes relacionados. Isso é
só um bônus quando disponível; a API sozinha já é suficiente pra rodar a revisão.

## Passo 7 — Revisar o diff

Para cada arquivo no escopo (Passo 5), a partir do `patch`, analise:

- **Lógica de negócio**: a lógica está correta? há edge cases não tratados?
- **Segurança**: injeção, exposição de dados, falta de autorização/autenticação, validação
  insuficiente de input
- **Performance**: queries N+1, falta de índice em migration, operação custosa sem
  cache/queue
- **Convenções Laravel/PHP**: o código segue as convenções da versão detectada no Passo 6?
- **Testes**: há cobertura pra essas alterações? quais cenários ficaram descobertos?
- **Migrations**: são reversíveis (`down()`)? podem causar downtime em produção (lock de tabela
  grande, coluna NOT NULL sem default)?

## Passo 8 — Endpoints novos/alterados

Se o diff tocar `routes/` ou métodos de Controller que correspondam a endpoints HTTP, liste-os:

```
[NOVO]     POST /api/v1/recurso
[ALTERADO] GET  /api/v1/recurso/{id}
```

Pergunte ao usuário se quer fornecer um `curl` de exemplo pra cada um pra validar contrato
(parâmetros obrigatórios/opcionais, autenticação, formato do payload, respostas esperadas) — isso
é opcional e só aprofunda a revisão, não bloqueia o relatório se o usuário preferir pular.

## Passo 9 — Relatório e validação

Monte o relatório final:

1. **Resumo executivo** — o que mudou, PR title/autor/base→head, risco geral (baixo/médio/alto)
2. **Contexto de stack** — PHP/Laravel/pacotes detectados no Passo 6, e upgrades relevantes
3. **Achados** — por categoria (lógica, segurança, performance, convenções, migrations, testes),
   cada um referenciando arquivo + trecho do diff
4. **Endpoints novos/alterados** (se houver)
5. **Roteiro de testes sugerido**
6. **Checklist de aprovação** — itens a verificar antes do merge

Ao final, **pergunte explicitamente**: quais achados o usuário confirma, quais quer ajustar, e
quais quer descartar. Só depois dessa validação o relatório é considerado concluído. Deixe claro
que este skill não posta nada no GitHub — cabe ao usuário levar o relatório validado pra revisão
manual no PR.
