# ROTAS CARBONITA — Google Apps Script + Google Sheets + GitHub

**Sistema web para levantamento anual e controle dos estudantes transportados da Rede Municipal de Educação de Carbonita/MG.**

## Estado de entrega (27/10/2026)

Código-fonte funcional preparado para implantação. **Ainda não está implantado**, porque é necessário autorizar uma conta Google institucional, uma planilha privada e a publicação do Apps Script. Não há servidor Supabase neste projeto. Não inclua dados reais de alunos durante o teste.

- Interface responsiva, em português, gerada pelo Google Apps Script (`Index.html`, `Styles.html`, `Client.html`).
- Banco central **Google Sheets**: a planilha é a origem dos dados e também o consolidado.
- **Apps Script**: controla autenticação, acesso às escolas e rotas, gravação, chamada e auditoria.
- **GitHub**: guarda versões dos arquivos; **a URL que as escolas/monitores acessarão será a do Aplicativo da Web do Apps Script**, não do GitHub Pages. Hospedar o HTML direto no Pages exigiria outra arquitetura de autenticação e integração CORS.
- Atualizações automáticas entre sessões a cada ~25 segundos, enquanto o app está aberto e conectado. Não é WebSocket nem tempo real instantâneo. Edições manuais na planilha também notificam as sessões por `onEdit`, **mas não passam pelas validações do aplicativo**. Evite-as.
- QR Code gerado **localmente** no navegador, sem serviço externo de geração; o código contém só um identificador aleatório.
- Leitura por câmera com `BarcodeDetector` em navegadores compatíveis; há chamada manual por nome e entrada manual do código nos demais.
- **Não funciona offline.** É preciso haver sinal para registrar chamada no ônibus.

## 1. Estrutura dos arquivos

| Arquivo | Onde vai | Função |
|---|---|---|
| `Code.gs` | Projeto Google Apps Script, arquivo Script | Servidor, planilha, login, permissões e chamadas |
| `Index.html` | Projeto Apps Script, arquivo HTML `Index` | Tela principal |
| `Styles.html` | Projeto Apps Script, arquivo HTML `Styles` | CSS / visual |
| `Client.html` | Projeto Apps Script, arquivo HTML `Client` | Funcionalidades das telas |
| `QRCodeVendor.html` | Projeto Apps Script, arquivo HTML `QRCodeVendor` | Biblioteca QR local, licença MIT |
| `appsscript.json` | Manifesto do Apps Script | Fuso horário America/Sao_Paulo |
| `tests/smoke.test.cjs` | GitHub / computador | Testes simulados do servidor (Node.js) |

**Importante:** O Apps Script usa a extensão `.html` também nos arquivos com CSS e JavaScript. Não altere a extensão. A inclusão é feita pelo servidor do Google dentro de `Index.html`.

## 2. Instalar em uma conta Google institucional

1. Entre na conta Google institucional que será **proprietária da planilha**. A conta deverá continuar ativa para o sistema funcionar.
2. No Google Drive, crie uma **Planilha Google nova, privada**, chamada por exemplo `Rotas Carbonita — Base oficial`.
3. Dentro dela, vá em **Extensões → Apps Script** e renomeie o projeto para `Rotas Carbonita`.
4. Substitua o conteúdo do arquivo padrão `Code.gs` pelo arquivo `Code.gs` deste pacote.
5. Em **+ → HTML**, crie quatro arquivos com estes nomes exatos: `Index`, `Styles`, `Client` e `QRCodeVendor`. Cole o conteúdo de cada arquivo do ZIP no arquivo correspondente. Não crie arquivo duplicado `Index.html.html`.
6. Em **Configurações do projeto**, habilite a opção de exibir `appsscript.json` (manifesto); abra o manifesto e copie o conteúdo de `appsscript.json` deste pacote. Salve.
7. Ainda em **Configurações do projeto → Propriedades do script**, crie três propriedades (não compartilhe seus valores):
   - `ADMIN_NOME`: nome de quem administrará a Secretaria.
   - `ADMIN_LOGIN`: login inicial, como `secretaria.educacao`.
   - `ADMIN_SENHA_INICIAL`: **senha provisória forte de no mínimo 12 caracteres**, escolhida pela Secretaria.
8. No editor, selecione a função **`instalarSistema`** no menu superior e clique **Executar**. Autorize as permissões para trabalhar com a planilha. Essa execução cria as 11 abas e o primeiro usuário Secretaria. A propriedade com a senha inicial é excluída após a criação.
9. No **Apps Script → Implantar → Nova implantação → Aplicativo da Web**, configure **Executar como: Eu** (a conta institucional). O acesso do web app pode precisar estar disponível a **Qualquer pessoa**, porque a aplicação possui autenticação própria com login e senha; **faça uma revisão de segurança e aprovação institucional antes de liberar acesso externo**.
10. Conclua a implantação e copie o endereço **terminado em `/exec`**. Este é o endereço que os usuários abrirão no celular, tablet ou computador. Faça login com as credenciais iniciais e **troque a senha no primeiro acesso**.

⚠️ **Não publique a planilha no Google Sheets.** Compartilhamento direto da planilha deve permanecer restrito aos administradores autorizados. A permissão da planilha e o login do aplicativo são coisas distintas: qualquer usuário que possa editar as abas `USUARIOS` ou `SESSOES` diretamente pode contornar regras do aplicativo. Evite compartilhar a base com escolas ou monitores.

### Atualizar o código depois da primeira implantação

Faça as alterações no Apps Script, salve, clique em **Implantar → Gerenciar implantações → Editar → Nova versão → Implantar**. Mantenha a mesma implantação para preservar o link. Antes de atualizar em produção, teste o novo código em uma planilha de homologação (dados fictícios).

## 3. Ordem inicial de utilização

1. **Secretaria → Escolas:** cadastre as escolas municipais.
2. **Secretaria ou Escola → Turmas:** cadastre as turmas para o ano escolhido.
3. **Secretaria ou Escola → Rotas:** cadastre rotas por escola e ano letivo.
4. **Secretaria ou Escola → Pontos:** cadastre pontos vinculados às rotas.
5. **Secretaria → Acessos:** crie contas individuais para os servidores das escolas e monitores; a conta escolar precisa estar vinculada a uma escola.
6. **Secretaria → Acessos → Atribuir rotas:** escolha as rotas de cada monitor no ano letivo selecionado.
7. **Secretaria ou Escola → Estudantes:** cadastre nome, turma, escola, rota, ponto, nome e celular do responsável. A rota e o ponto podem ficar pendentes.
8. **Monitor → Estudantes:** veja os alunos de suas rotas; classifique os pendentes nas escolas atendidas pela rota atribuída. Para os pendentes, o número do responsável não é mostrado enquanto não houver vínculo de rota.
9. **Secretaria ou Escola → Crachá QR:** abra o cartão do estudante, imprima e entregue o crachá correspondente.
10. **Monitor → Chamada:** no celular, os botões **Ida · Para a escola** e **Volta · Para casa** ficam em destaque e acessíveis durante a rolagem. Escolha o trajeto, a data e a rota; depois registre quem embarcou manualmente ou pelo QR. Ida e volta são salvas **separadamente**, mesmo para o mesmo estudante e data. O monitor só consegue registrar estudante de rota atribuída a ele.
11. **Relatórios e Impressão:** todas as telas de listagem podem ser impressas pelo comando `Imprimir`; estudantes, rotas, escolas, turmas, usuários, pontos e chamadas têm exportação CSV quando aplicável.

## 4. Regras de acesso

| Operação | Secretaria | Escola | Monitor |
|---|---|---|---|
| Visualizar todos os alunos/rotas | Sim | Não | Não |
| Gerenciar escolas | Sim | Não | Não |
| Gerenciar turmas, rotas, pontos e alunos | Todas | Apenas sua escola | Não; pode vincular rota/ponto em alunos pendentes da escola atendida |
| Ver celular do responsável | Conforme necessidade | Na própria escola | Apenas dos estudantes já vinculados à sua rota |
| Gerenciar usuários e atribuições de rotas | Sim | Não | Não |
| Registrar chamada | Sim | Somente consulta | Apenas próprias rotas |
| Imprimir crachás QR | Sim | Própria escola | Não |
| Criar ano letivo | Sim | Não | Não |

Os filtros visuais não são a proteção principal. As permissões são aplicadas novamente na função `api` no Apps Script para cada solicitação.

## 5. Abas criadas automaticamente

`ANOS`, `ESCOLAS`, `TURMAS`, `ROTAS`, `PONTOS`, `ESTUDANTES`, `USUARIOS`, `ATRIBUICOES`, `CHAMADAS`, `AUDITORIA`, `SESSOES`.

- Todas usam identificadores internos únicos, não apenas nomes.
- `ESTUDANTES` registra um cadastro específico por **ano letivo**; criar um novo ano não transfere automaticamente os estudantes antigos.
- `CHAMADAS`: data, sentido (`IDA`/`VOLTA`), estudante, rota, ponto, presença/ausência, usuário e horário.
- `USUARIOS`: hashes das senhas e dados de perfil, **não contém senha em texto aberto**.
- `SESSOES`: hashes dos tokens de acesso, com validade de 12 horas. Não compartilhe esta aba.
- `AUDITORIA`: registra ação, data, entidade e operador (não armazena cópia de dados sensíveis).

**Não renomeie abas nem colunas.** A exclusão manual de linhas pode quebrar referências internas. Se a Secretaria editar manualmente uma célula na base, o evento `onEdit` sinaliza a mudança para a interface no próximo ciclo de consulta. No entanto, entradas manuais ignoram validações do aplicativo. **Prefira o app para cadastrar e alterar.**

## 6. GitHub

Crie um repositório (preferencialmente **privado**) para o código-fonte, não para a planilha. O repositório deve conter `Code.gs`, os HTMLs, `appsscript.json`, este README e os testes. **Nunca envie planilhas com dados de alunos, chaves, senhas, tokens de sessão ou propriedades de script ao GitHub.**

Se já tiver o Git instalado:

```bash
cd Rotas_Carbonita_Apps_Script
git init
git add Code.gs Index.html Styles.html Client.html QRCodeVendor.html appsscript.json README.md tests/smoke.test.cjs
git commit -m "Primeira versão: transporte escolar com Apps Script e Google Sheets"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
git push -u origin main
```

Se desejar, é possível usar a ferramenta oficial `clasp` para versionar e enviar esse código do computador ao Apps Script, após autenticação e configuração do projeto vinculado. Isso é opcional: copiar os arquivos no editor também funciona.

## 7. Segurança e produção

O sistema armazena **dados pessoais de estudantes, inclusive menores de idade**. Antes da implantação oficial, a Prefeitura deve definir finalidade de tratamento, responsáveis, controles de acesso, prazo de retenção e adequação à **LGPD**, e validar os riscos de uma aplicação publicada como “Qualquer pessoa” com autenticação própria.

Existem recursos básicos de segurança: login individual com senha forte, hash HMAC-SHA256 por usuário com salt e segredo fora da planilha, limitação de tentativas por login, tokens de sessão com prazo, conferência de perfil no servidor, gravações protegidas por `LockService`, escape HTML no cliente e trilha de auditoria. **Essas medidas não substituem auditoria de segurança, autenticação corporativa com MFA e testes de carga antes do uso com dados reais.**

Considere implementar em etapa posterior: autenticação integrada ao Google Workspace institucional, MFA, procedimentos formais de recuperação de contas, expiração/limpeza programada de sessões, limite adicional contra ataques por múltiplos logins, backups automáticos e restauração, política de privacidade, retenção e auditoria detalhada, fila de chamada offline e biblioteca de leitura QR universal.

**Limitação relevante:** o Apps Script e o Sheets possuem cotas e não foram dimensionados aqui para a quantidade real de estudantes, monitores e chamadas simultâneas. Teste com dados sintéticos e diferentes contas, inclusive no sinal de internet de rotas rurais, antes de colocar o sistema em operação.

## 8. Testes locais

Execute com Node.js instalado:

```bash
node tests/smoke.test.cjs
```

O teste simula o servidor e verifica: instalação, troca obrigatória de senha, cadastros, restrições por perfil, definição de rota do monitor, QR, chamada com registro único, criação de ano e preservação de atribuições de anos anteriores, e encerramento de sessão.

**Não equivale a teste no ambiente Google real.** É necessário fazer uma homologação com uma planilha de teste e usuários fictícios.

## 9. Referências técnicas

- Apps Script Web Apps: https://developers.google.com/apps-script/guides/web
- HTMLService / google.script.run: https://developers.google.com/apps-script/guides/html/communication
- LockService: https://developers.google.com/apps-script/reference/lock/lock-service
- Cotas do Apps Script: https://developers.google.com/apps-script/guides/services/quotas
- QRCode for JavaScript, Kazuhiko Arase — licença MIT, incluída em `QRCodeVendor.html`.

## Atualização v2 — chamada em Ida e Volta (mobile)

- No painel inicial do monitor ou da Secretaria, **no celular**, existem dois atalhos para abrir diretamente a chamada: **Ida — Para a escola** e **Volta — Para casa**.
- Na tela Chamada, os dois botões permanecem destacados e ficam fixos no topo durante a rolagem no celular. A opção selecionada é marcada por texto, borda, cor e ✓.
- **Selecionar Ida/Volta não registra presença**: o embarque só é salvo ao tocar **Embarcou** ou validar o QR do crachá.
- **Ida** salva `sentido=IDA`, identificando que o estudante embarcou para ir à escola; **Volta** salva `sentido=VOLTA`, identificando embarque de retorno para casa. Os dois trajetos podem ser registrados no mesmo dia sem se sobrescrever.
- Os cards de chamada mostram `Embarcou`, `Não embarcou` ou `Aguardando`, com horário do registro. As correções de um lançamento existente exigem confirmação.
- Os campos existentes da planilha `CHAMADAS` permanecem os mesmos; não é necessário migrar ou apagar registros.

**Para atualizar uma implantação existente:** substitua `Client.html`, `Styles.html` e `Code.gs` pelos arquivos deste pacote e publique uma **nova versão da implantação** do Apps Script. Não execute `instalarSistema()` outra vez e não recrie a planilha. O GitHub pode guardar as versões do projeto.
