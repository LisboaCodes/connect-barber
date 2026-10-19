# 📊 Status do Projeto - Connect Barber

**Última atualização:** 19/10/2026

## Objetivo

Concorrente do AppBarber: gestão completa para barbearias (agenda online, comandas, caixa, estoque, comissões, fidelidade, comunicação automática, site da barbearia) com teste grátis de 30 dias e planos por número de profissionais.

## Backend (API) — ✅ completo (v1)

| Módulo | Entregue |
|---|---|
| auth | cadastro da barbearia (30 dias grátis), cadastro de cliente, login, refresh, troca de barbearia, perfil, senha, esqueci/redefinir senha |
| tenants | dados da barbearia, horário de funcionamento, regras de agendamento online, mensagens automáticas, equipe/acessos por papel, formas de pagamento com taxas |
| professionals | CRUD, comissões, serviços que executa, acesso de login, jornada por dia da semana, folgas/jornadas específicas, bloqueios |
| services | categorias, serviços, preço/duração por profissional, reordenação |
| clients | CRUD, busca, tags, aniversariantes, importação, histórico completo |
| appointments | agenda, horários livres (jornada ∩ funcionamento − bloqueios − agendamentos), criação com cliente novo, encaixe, recorrência, status, cancelamento com aviso à lista de espera, confirmação/lembrete/cancelamento por WhatsApp/e-mail |
| orders | comanda do agendamento ou avulsa, itens (serviço/produto/pacote/avulso/consumo de pacote), desconto geral e por item, clube (desconto automático), pagamentos com taxas por parcela, pontos como pagamento, fechamento (caixa + estoque + comissões + fidelidade + pacotes + fiado), reabertura, cancelamento, comanda de consumo do profissional |
| cashier | abrir/fechar, movimentações, sangria/suprimento, conferência, histórico |
| finance | contas a pagar/receber com parcelas, pagar/estornar, categorias, fluxo de caixa |
| products | CRUD, categorias, movimentações de estoque, inventário, alertas |
| commissions | lançamentos, resumo por profissional, vales, fechamento por período (desconta vales e consumo), pagamento |
| loyalty | programa de pontos, prêmios, resgate (inclusive pedido pelo cliente), ajuste, ranking, pacotes, clube |
| engagement | campanhas por público (envio/agendamento/leitura), lista de espera, regras de mensagem de retorno, pesquisa de satisfação, log de mensagens |
| reports | dashboard, agendamentos (dia da semana/hora/origem/status/profissional/clientes), ocupação, retorno, financeiro, ticket médio, movimentações |
| public | site da barbearia, disponibilidade e agendamento online (com/sem login, com pré-pagamento opcional ou obrigatório), lista de espera, pesquisa, área do cliente (agendamentos, fidelidade, resgate, perfil), **totem de autoatendimento** (identificação, check-in, encaixe, pagamento) |
| payments | CreativePay por barbearia (Pix QR, checkout hospedado, webhook, liquidação em comanda/agendamento), Mercado Pago Point (maquininha), consulta periódica de pendentes |
| billing | planos, assinatura com checkout CreativePay, faturas, renovação/bloqueio automáticos, pagamento online de comanda, webhook |
| automation | cron de lembretes, pesquisa, retorno, aniversário, campanhas, expiração de pontos/lista de espera/pacotes, plano |
| admin | visão geral da plataforma, barbearias, plano/trial/bloqueio, faturas |

Teste de ponta a ponta (script em scratch) passou: agendamento online → comanda → pagamento → fechamento → estoque/comissão/pontos → reabertura → relatórios → cadastro de nova barbearia → assinatura → recorrência.

## Frontend (web) — ✅ completo (v1)

- Fundação: kit de UI, layouts (site, painel com menu por papel, guards), rotas, store, cliente de API com refresh.
- Páginas: site institucional (home, funcionalidades, preços), auth (dono e cliente), onboarding, dashboard, agenda (dia/semana/lista, encaixe, recorrência, bloqueios), comandas e detalhe, caixa, clientes e histórico, profissionais (jornada, folgas, acesso), serviços, produtos/estoque/inventário, financeiro, comissões, relatórios, fidelidade/pacotes/clube, campanhas, lista de espera, pesquisas, mensagens, configurações, site e agendamento online, plano, perfil, admin da plataforma, site público /b/:slug com agendamento online e lista de espera, avaliação e área do cliente.
- Testado no navegador contra a API: landing, login, dashboard, agenda, comanda a partir do agendamento, agendamento online de ponta a ponta e todas as páginas do painel sem erros de console.

## Produção

Deploy v1 em 18/10/2026: https://connect-barber.creativenext.cloud (app) e https://api-connect-barber.creativenext.cloud/api (API). Demo em /b/barbearia-demo.

## 19/10/2026 — cobrança dos planos, admin e revisão mobile

- **CreativePay configurado para os planos**: Aplicação de API "Connect Barber" (id 6) + envs `CREATIVE_PAY_*` na API. O dono clica em **Pagar agora** em Meu plano e abre o checkout (Pix/cartão); sessão de 24h regenerada quando vence (`POST /billing/invoices/:id/checkout`). Webhook assinado (`X-CreativePay-Signature`) trata `order.pending`/`order.completed`/`order.refunded` e avisa a barbearia por e-mail e WhatsApp. Testado em produção (sessão criada, assinatura validada); falta apenas um pagamento real por Pix.
- **Admin**: aba Faturas (todas as barbearias, filtro por status, gerar/copiar link de pagamento, marcar paga) e card de integrações (CreativePay/Resend/WhatsApp/mensagens 7 dias).
- **WhatsApp**: envio real pela instância compartilhada testado.
- **Resend**: domínio `creativenext.cloud` criado na conta; **faltam os registros DNS na Cloudflare** (lista em `SERVIDOR/SERVIDOR.md`). Até lá os e-mails ficam como FAILED em message_logs.
- **Mobile**: corrigido transbordo horizontal (dashboard e relatórios). Varredura automática (Playwright) de todas as páginas públicas e do painel em desktop e celular sem erro de console ou HTTP; agendamento online de ponta a ponta validado no ambiente local.

## 19/10/2026 (noite) — upload de imagens

- **Upload pelo painel** em vez de colar URL: logotipo (Configurações e Site), capa, galeria (várias fotos de uma vez), foto do perfil e foto do profissional. Componente `ImageUpload`/`UploadButton` reduz a imagem no navegador (máx. 1600 px, PNG mantém transparência) e ainda permite colar um link.
- **API `/api/media`**: `POST` (multipart `file`, até 5 MB, JPG/PNG/WEBP/GIF verificados pela assinatura, cota de 300 MB por barbearia), `GET /:id` público com cache imutável + ETag, `DELETE /:id` pelo dono. Imagens ficam na tabela `media_files` (no Postgres, então entram no backup do banco). Env opcional `API_PUBLIC_URL` define o host dos links (em produção: `https://api-connect-barber.creativenext.cloud`).
- Correção de robustez: o serializador global agora corta referências circulares (um handler com `@Res()` devolvia o Response do Express e derrubava a API por falta de memória).
- Testado localmente (API via curl e painel via Playwright no celular: site, galeria, página pública, perfil e profissional sem erros).

## Próximos passos

1. Adicionar os registros DNS do Resend na Cloudflare e verificar o domínio; testar e-mails (boas-vindas, fatura, lembrete).
2. Primeiro pagamento real de plano por Pix (Efí) e conferir o webhook.
3. Testes de uso real com uma barbearia piloto e ajustes de UX.
4. Imagens de serviços e produtos (campos existem no banco, ainda sem tela).
5. App nas lojas (hoje é PWA instalável).
