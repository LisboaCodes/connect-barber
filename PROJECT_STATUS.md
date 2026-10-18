# 📊 Status do Projeto - Connect Barber

**Última atualização:** 18/10/2026

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
| public | site da barbearia, disponibilidade e agendamento online (com/sem login), lista de espera, pesquisa, área do cliente (agendamentos, fidelidade, resgate, perfil) |
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

## Próximos passos

1. Testes de uso real com uma barbearia piloto e ajustes de UX.
3. Configurar CreativePay (aplicação de API + webhook) para a cobrança dos planos.
4. Verificar domínio no Resend e a instância do WhatsApp para as mensagens.
5. PWA/instalável no celular; depois app nas lojas.
