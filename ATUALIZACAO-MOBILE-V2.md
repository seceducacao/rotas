# Atualização da chamada no celular — Ida e Volta (v2)

Esta atualização mantém **Google Sheets + Google Apps Script** como banco e servidor. O GitHub continua opcional para versionar o código. Não há necessidade de Supabase.

## O que muda

- No painel inicial do monitor (e da Secretaria), dois botões de acesso rápido **Ida — Para a escola** e **Volta — Para casa** aparecem no celular.
- Na tela **Chamada**, os dois botões permanecem **visíveis durante a rolagem** (fixos no topo no celular). A opção ativa é marcada por cor, borda, texto e ✓.
- Escolher um botão **não salva a chamada**. Somente confirmar **Embarcou** ou ler o crachá QR registra o aluno.
- Os registros de ida e volta são separados, com data, horário, rota, estudante e monitor. O status **Não embarcou** também é disponível.
- Ao selecionar outro trajeto, a lista e os totais mostram somente os registros da opção selecionada. Horários são exibidos no fuso de Carbonita (America/Sao_Paulo).

## Como atualizar um sistema já instalado

1. Abra o projeto do **Google Apps Script** associado à planilha atual.
2. Substitua o conteúdo dos arquivos **`Client.html`**, **`Styles.html`** e **`Code.gs`** pelos arquivos da nova versão.
3. Clique em **Salvar** e use **Implantar → Gerenciar implantações → Editar → Nova versão → Implantar**. Caso use implantação de teste, atualize-a conforme a documentação do Google.
4. No celular, abra/recarregue o link do aplicativo. Vá a **Visão geral** ou **Chamada** para visualizar os botões.
5. Teste com um **aluno fictício**: marque “Embarcou” em Ida, alterne para Volta e marque “Embarcou” novamente. Confira na aba `CHAMADAS` duas linhas, uma `IDA` e outra `VOLTA`.

**Não execute `instalarSistema()` novamente, não apague a planilha e não copie dados reais para o GitHub.** As colunas atuais do Google Sheets continuam iguais.

## Arquivos

- `Client.html`: botões, mudança de trajeto, cards, horários e scanner.
- `Styles.html`: layout com botões de toque, mobile responsivo e seleção visual.
- `Code.gs`: inclui no resultado do registro a informação do sentido, usada na mensagem de confirmação; preserva o modelo do banco de dados.
- `tests/`: testes locais da lógica de servidor e da interface.

**Observação:** alteração de interface validada em teste de código local, mas ainda depende de publicação e teste final no seu Google Apps Script e nos celulares reais. Registros exigem internet.
