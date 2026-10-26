# Validação — LobbyLive

Data: **26/10/2026**. Evidências locais com execução real, sem simular PostgreSQL ou o transporte Socket.IO.

## Checks executados

| Verificação | Resultado |
|---|---|
| ESLint sem reescrita | Aprovado |
| TypeScript, incluindo testes | Aprovado |
| Build compilado | Aprovado |
| Jest unitário | 9 testes aprovados |
| REST e Socket.IO E2E | 32 testes aprovados |
| Auditoria npm | 0 vulnerabilidades reportadas |
| Configuração e build Docker | Aprovados |
| Migration em banco vazio e reexecução | Aprovadas; sem migrations pendentes |
| Schema ORM versus PostgreSQL | Sem diferenças, verificado pela suíte |
| Demo de dois clientes contra Docker | Entrada, snapshot, chat e saída aprovados |

## Ambiente verificado

- API em Docker na porta local **3002**, usuário `node` (UID 1000), com healthcheck.
- PostgreSQL **17.11**, porta local **5434**, com volume persistente.
- Banco E2E separado em tmpfs na porta **5435**. Os testes só limpam uma base cujo nome termina em `_test`.
- Serviço `migrate` conclui com código **0** antes da API. CLI de desenvolvimento e serviço Docker reaplicados sem pendências.
- Swagger renderizado e inspecionado no navegador em `http://localhost:3002/docs`, incluindo autenticação Bearer. A presença de todas as rotas no OpenAPI também é verificada por teste HTTP.

## Casos de comportamento comprovados

Autenticação com Argon2id/JWT, normalização e unicidade de nickname inclusive sob concorrência, login inválido com resposta genérica, rejeição de DTOs inválidos e proteção das rotas.

Dois clientes reais entram e trocam mensagens; eventos não vazam para outra sala. Comandos inválidos retornam acknowledgement de erro ou `operation:error` quando não há callback. Um não membro não consegue consultar participantes nem enviar chat.

Duas conexões da mesma conta ocupam uma vaga. Somente a última conexão saindo gera `participant:left`. Entrada/saída repetidas são idempotentes. A disputa simultânea pela última vaga aceita uma única conta. Desconexão limpa múltiplas salas; expiração do JWT também remove a presença. Reconexão precisa de entrada explícita e não recebe replay.

## Reinício real da API e do banco

Uma prova adicional criou duas contas sintéticas e uma sala, conectou dois clientes e enviou uma mensagem. Com ambos ativos, foram reiniciados **API e PostgreSQL** via Compose.

Após recuperação:

- Os mesmos usuários puderam fazer login com as senhas originais.
- IDs, nicknames e datas das contas permaneceram idênticos.
- A sala manteve ID, nome, capacidade, criador e data, com **zero participantes**.
- Nova conexão recebeu `NOT_IN_ROOM` antes de entrar novamente.
- Nenhuma mensagem anterior foi recuperada após entrar.

A prova e `npm run demo` criam somente dados sintéticos e não os removem. Senhas e tokens não são impressos, gravados no relatório ou enviados ao repositório. `.env` fica ignorado pelo Git, com segredo JWT local aleatório.

## Reprodução dos checks

```bash
npm ci --ignore-scripts
npm run env:init
npm run lint
npm run typecheck
npm run build
npm test -- --runInBand
docker compose --profile test up -d --wait test-db
DB_PORT=5435 DB_USER=lobbylive DB_PASSWORD=lobbylive_test \
  TEST_DB_NAME=lobbylive_test npm run test:e2e
docker compose up --build -d --wait
npm run demo
npm run migration:pending
docker compose run --rm migrate
git diff --check
```

## Limites

A API e seu PostgreSQL ficam em execução local; o banco temporário de testes é encerrado após os checks. Presença e mensagens não são persistidas, por projeto. A aplicação opera em uma instância e não foi hospedada publicamente.

## Publicação e CI remota confirmadas

Repositório **público**: [JoaoVictorAAbreu-Dev/lobbylive](https://github.com/JoaoVictorAAbreu-Dev/lobbylive), branch principal `main`, com commits separados de implementação, testes e infraestrutura/documentação.

A [execução 40374750353](https://github.com/JoaoVictorAAbreu-Dev/lobbylive/actions/runs/40374750353), referente ao commit de entrega `be2522df0dea81d5f2fe0d953130ac468b10f9f9`, terminou com **success** em 26/10/2026. No runner GitHub passaram instalação, lint, typecheck, build, testes unitários, testes REST/Socket.IO com PostgreSQL real, verificação de diff e build da imagem Docker.

O commit posterior apenas registra esta evidência e usa `[skip ci]`; o código e o workflow verificados permanecem os mesmos. Isso comprova a CI do projeto público; não altera nem resolve a restrição de faturamento anteriormente observada no repositório privado GameScore.

Antes do envio, foi conferido que `.env`, dependências e artefatos de build não são rastreados e que o segredo JWT local não está nos arquivos públicos. O repositório GameScore permaneceu sem alterações.

## Frontend React — validação no navegador em 26/10/2026

Adicionado `web/`, servido pelo Compose na porta 3003. REST e Socket.IO passam pelo proxy Nginx da mesma origem. Nenhuma rota ou regra do backend foi alterada.

Fluxo observado em dois clientes de navegador independentes:

- Cadastro e login reais de duas contas sintéticas pela interface.
- Criação de “Squad da noite” pelo modal e entrada automática do criador.
- Atualização da lista e entrada da segunda conta: os dois clientes exibiram dois participantes.
- Mensagens enviadas nos dois sentidos foram exibidas na conversa oposta e na própria.
- Saída da segunda conta gerou aviso e reduziu a presença no primeiro cliente para uma pessoa.
- Logout voltou à tela de acesso; senha incorreta exibiu “Nickname ou senha incorretos.”.
- A primeira conta entrou em uma segunda sala sem sair da primeira; ambas apareceram na navegação lateral.

A inspeção visual foi realizada no viewport disponibilizado pelo navegador do app. O CSS inclui breakpoints menores, mas não há prova visual específica de dispositivo móvel nesta rodada. Mensagens e sessões do teste são sintéticas. O token permanece apenas em memória; recarregamento exige login novamente.
