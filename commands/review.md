---
name: review
description: Revisa um Pull Request do GitHub — /review <link-do-PR>
---

Argumento recebido: `$ARGUMENTS`

Deve ser um link de PR do GitHub (`https://github.com/{owner}/{repo}/pull/{n}`) ou uma referência
equivalente (`owner/repo#n`). Se estiver ausente ou não for reconhecível como tal, peça o link ao
usuário em português (pt-BR) — não tente adivinhar.

Não implemente a lógica de revisão aqui. Invoque o skill `review`, passando o link — toda a
lógica (busca do PR/diff via API do GitHub, detecção de versão de PHP/Laravel via composer.json,
dimensões da revisão, e a regra de nunca postar no GitHub e sempre esperar validação do usuário)
vive em `skills/review/SKILL.md`. Este comando existe só para permitir invocação explícita via
`/review ...`; o skill também pode ser acionado por relevância quando o usuário colar um link
de PR sem usar o comando.
