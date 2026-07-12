# 00 — Visão do Produto

## Nome de trabalho

Mantiqueira Maintenance Hub.

O nome pode ser alterado pelo administrador no futuro.

## Problema que o sistema resolve

A manutenção precisa de uma visão única da operação:

- Onde está cada ativo.
- O que está instalado em cada postura e bateria.
- Qual motor e qual redutor estão presentes.
- Qual equipamento está com falha.
- Quais OS estão abertas.
- Quem está atendendo.
- O que já aconteceu com aquele ativo.
- Quando um motor foi trocado.
- Qual marca apresenta mais reincidência.
- Quais cadastros estão incompletos.
- Onde existem determinados modelos e marcas.

## Visão do produto

O sistema deve funcionar como um "mapa vivo" da manutenção.

A navegação ideal é:

`Mapa físico -> Postura -> Bateria -> Ativo -> Dados técnicos -> Histórico -> OS`

Também deve funcionar no sentido inverso:

`Pesquisa global -> Motor NORD -> Resultado -> Postura 27/B2 -> Ativo -> Histórico`

## Princípios

### Visual primeiro

O usuário deve entender o estado do sistema olhando.

### Complexidade sob demanda

A Home deve ser limpa.
Detalhes aparecem quando o usuário clica.

### Dado físico e histórico

O sistema representa equipamentos reais instalados.

### Histórico preservado

Trocar um motor não apaga o passado.

### Configuração profunda

O administrador controla aparência, textos, módulos, status, prioridades, sons e vários comportamentos.

### Campo e escritório

O sistema deve funcionar tão bem no celular durante uma manutenção quanto no desktop em uma análise gerencial.

## Módulos principais

- Home.
- Ordens de Serviço.
- Mapa das Posturas.
- Inventário Técnico.
- Análises.
- Administração.

## Módulos secundários

- Pesquisa global.
- Favoritos.
- Histórico/Auditoria.
- Relatórios.
- Notificações.
- Biblioteca de modelos.

## O que não é prioridade central

- Almoxarifado.
- Controle de saldo de rolamentos e peças.
- ERP financeiro.
- Compras.

Esses assuntos podem existir como integração futura, mas não devem deformar a arquitetura atual.
