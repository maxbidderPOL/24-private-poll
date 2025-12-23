# Private Poll

Anonymous polling platform with fully homomorphic encryption (FHE). Create polls where participants submit encrypted numeric responses. Poll creators see statistics (counts, averages) without seeing individual answers.

## How It Works

1. Create a poll with a question and a numeric range (e.g., 1-5 for ratings)
2. Participants choose a number from that range
3. Responses are encrypted using FHE before being stored on blockchain
4. You see response statistics without seeing who answered what

## Features

- Create polls with custom numeric ranges
- Encrypted responses via FHE
- One response per participant
- View response counts and statistics
- Close polls anytime

## Quick Start

Install dependencies:
```bash
npm install
```

Create `.env.local`:
```env
NEXT_PUBLIC_POLL_CONTRACT_ADDRESS=0x8D43fa1fc5c895b762c7d61548C7DC2Aa11E11Ff
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_id
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
PRIVATE_KEY=your_private_key_for_deployment
```

Run locally:
```bash
npm run dev
```

Deploy contract:
```bash
npm run deploy:poll
```

## Contract

Address: `0x8D43fa1fc5c895b762c7d61548C7DC2Aa11E11Ff`  
Network: Sepolia testnet

## Tech Stack

- Next.js 14, React, TypeScript
- Tailwind CSS
- Zama FHEVM Relayer SDK
- Wagmi, RainbowKit
- Solidity

## License

MIT

---

# Private Poll (Русский)

Платформа для анонимных опросов с полным гомоморфным шифрованием (FHE). Создавайте опросы, где участники отправляют зашифрованные числовые ответы. Создатели опросов видят статистику (количество, средние значения) без просмотра отдельных ответов.

## Как это работает

1. Создайте опрос с вопросом и числовым диапазоном (например, 1-5 для оценок)
2. Участники выбирают число из этого диапазона
3. Ответы шифруются с помощью FHE перед сохранением в блокчейне
4. Вы видите статистику ответов, не зная, кто что ответил

## Возможности

- Создание опросов с произвольными числовыми диапазонами
- Зашифрованные ответы через FHE
- Один ответ от каждого участника
- Просмотр количества ответов и статистики
- Закрытие опросов в любое время

## Быстрый старт

Установка зависимостей:
```bash
npm install
```

Создайте `.env.local`:
```env
NEXT_PUBLIC_POLL_CONTRACT_ADDRESS=0x8D43fa1fc5c895b762c7d61548C7DC2Aa11E11Ff
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_id
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
PRIVATE_KEY=your_private_key_for_deployment
```

Запуск локально:
```bash
npm run dev
```

Деплой контракта:
```bash
npm run deploy:poll
```

## Контракт

Адрес: `0x8D43fa1fc5c895b762c7d61548C7DC2Aa11E11Ff`  
Сеть: Sepolia testnet

## Технологии

- Next.js 14, React, TypeScript
- Tailwind CSS
- Zama FHEVM Relayer SDK
- Wagmi, RainbowKit
- Solidity

## Лицензия

MIT
