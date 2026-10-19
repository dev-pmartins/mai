---
name: uat
description: Ajuda a elaborar um plano de teste/UAT (homologação) fazendo perguntas até reunir insumo suficiente sobre o sistema a homologar, partes interessadas, aprovadores, e as regras de como e onde reportar bugs/melhorias (com os tipos blocker/ajuste/alteração). Produz o plano final e publica como Artifact para compartilhar com os interessados. Use quando o usuário invocar /uat ou pedir ajuda para montar um plano de teste/UAT/homologação.
---

Este skill conduz uma entrevista curta para reunir os insumos de um plano de teste/UAT e, ao
final, monta o documento e publica como Artifact (a entrega tem público — partes interessadas e
aprovadores — então vive numa página compartilhável, não só no chat).

**Sempre responda ao usuário em português (pt-BR)** — perguntas, rascunho, documento final. Estas
instruções estão em português/inglês técnico só para clareza do modelo.

**Nunca invente informação.** Se um campo não foi respondido, pergunte — não preencha com um
placeholder genérico ("a definir") a não ser que o usuário diga explicitamente que quer deixar
em aberto.

## Passo 1 — Reunir os insumos

Pergunte, um de cada vez ou agrupando os que fizerem sentido juntos, até ter todos os itens
abaixo. Se o usuário já adiantou algum no pedido inicial, não pergunte de novo — só confirme os
que faltam:

1. **Nome do sistema** a ser homologado.
2. **URL do sistema** (ambiente de homologação/UAT).
3. **Partes interessadas** — quem participa do teste (pessoas/áreas responsáveis por validar).
4. **Aprovadores** — quem formalmente aprova/assina a homologação (pode ser um subconjunto das
   partes interessadas ou outra pessoa).
5. **Tipos de ocorrência e suas definições**, usados para classificar bugs/problemas/melhorias
   reportados durante o teste. Proponha o padrão abaixo e pergunte se o usuário quer manter,
   ajustar a redação, ou adicionar/remover tipos:
   - **Blocker** — precisa ser corrigido antes da entrega.
   - **Ajuste** — pode ser corrigido após a entrega.
   - **Alteração** — deve ser corrigido depois da entrega.
6. **Canal de reporte** — onde bugs/problemas/melhorias devem ser reportados (ex: canal do
   Slack, board do Runrun.it, planilha, e-mail). Pergunte também se há um formato esperado para
   o reporte (ex: título, passos para reproduzir, evidência/print, tipo classificado conforme o
   item 5) — se o usuário não tiver um formato específico, sugira um mínimo (descrição do
   problema, passos, evidência, tipo) e confirme.

Não avance para o Passo 2 enquanto faltar algum destes itens, a menos que o usuário peça
explicitamente para pular um deles.

Depois de reunir os seis itens acima, pergunte se o usuário quer incluir também os pontos
opcionais abaixo (deixe claro que são opcionais — o plano pode ser publicado sem eles):

7. **Escopo/critérios de aceite** — quais funcionalidades entram no teste e o que define que
   algo foi "aprovado".
8. **Cronograma** — data de início/fim do período de homologação, e prazo para reportar
   bloqueios.
9. **Ambiente/dados de teste** — credenciais de acesso, massa de dados, particularidades do
   ambiente de homologação em relação à produção.
10. **Critério de saída/rollback** — o que acontece se um blocker não for resolvido a tempo
    (adia a entrega? entrega com ressalva?).

Para cada um desses quatro, se o usuário não souber ou disser que não se aplica, omita a seção
correspondente no rascunho em vez de forçar uma resposta.

## Passo 2 — Rascunho

Monte um rascunho do plano com as seções:

1. **Sistema homologado** — nome + URL
2. **Partes interessadas**
3. **Aprovadores**
4. **Como reportar problemas e melhorias** — tipos de ocorrência (item 5) e o formato esperado
   do reporte
5. **Canal de reporte**
6. **Escopo/critérios de aceite** (se fornecido no Passo 1)
7. **Cronograma** (se fornecido)
8. **Ambiente/dados de teste** (se fornecido)
9. **Critério de saída/rollback** (se fornecido)

Mostre o rascunho ao usuário e peça confirmação ou ajustes antes de publicar. Não adicione seções
além das listadas acima (nem as opcionais que o usuário tenha dispensado) — se ele quiser incluir
algo diferente, pergunte o conteúdo em vez de supor.

## Passo 3 — Publicar

Só depois da confirmação explícita do rascunho, publique o documento como Artifact:

- Carregue o skill `artifact-design` antes de escrever o HTML, para calibrar o nível de design
  adequado a um documento formal (não é preciso um visual elaborado, mas deve ser legível e bem
  organizado — títulos, seções claras, tabela para tipos de ocorrência).
- Título do artifact: nome do sistema (ex: "UAT — Portal do Corretor"), não um rótulo genérico
  como "Plano de Teste".
- Depois de publicar, entregue o link ao usuário.

Se o usuário pedir para atualizar um plano já publicado (em vez de criar um novo), use a URL do
artifact existente (`action: "read"` primeiro, depois publique nela) em vez de gerar um link novo.
