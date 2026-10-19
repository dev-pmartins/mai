---
name: gmud
description: Gera a documentação de uma GMUD comparando duas branches — /gmud [base] [head]
---

Argumentos recebidos: `$ARGUMENTS`

Opcionais. Se vierem, são as branches `base` e `head` a comparar (nessa ordem); se vier só uma,
trate como `head`. Se não vierem, o skill propõe as branches a partir do cache ou da branch atual.

Não implemente a lógica da GMUD aqui. Invoque o skill `gmud`, repassando os argumentos — toda a
lógica (cache por aplicação em `$MAI_ROOT/.cache/gmud/`, detecção de stack, checagem das
branches, análise de pacotes/banco/env, code review rápido, relatório Markdown e PDF não técnico
opcional) vive em `skills/gmud/SKILL.md`. Este comando existe só para permitir invocação
explícita via `/gmud ...`; o skill também pode ser acionado por relevância quando o usuário pedir
para criar uma GMUD sem usar o comando.
