---
name: uat
description: Ajuda a montar um plano de teste/UAT — /uat [contexto opcional]
---

Argumento recebido: `$ARGUMENTS`

Pode vir vazio ou já trazer parte do insumo (ex: nome do sistema, URL, partes interessadas).

Não implemente a lógica aqui. Invoque o skill `uat`, passando o que já foi fornecido — toda a
entrevista (quais campos são obrigatórios, os tipos padrão de ocorrência, a regra de nunca
inventar informação) e a publicação do plano final como Artifact vivem em `skills/uat/SKILL.md`.
Este comando existe só para permitir invocação explícita via `/uat ...`; o skill também pode ser
acionado por relevância quando o usuário pedir ajuda para montar um plano de teste/UAT sem usar o
comando.
