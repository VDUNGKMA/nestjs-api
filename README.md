<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://coveralls.io/github/nestjs/nest?branch=master" target="_blank"><img src="https://coveralls.io/repos/github/nestjs/nest/badge.svg?branch=master#9" alt="Coverage" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

# NestJS Cinema Booking API

A RESTful API for a cinema booking system with high-concurrency seat reservation capabilities.

## Features

- User authentication and authorization
- Movie and screening management
- Theater and seat management
- High-concurrency seat reservation system
- Ticket booking and payment processing
- QR code generation

## High-Concurrency Reservation System

The system is built to handle millions of concurrent seat reservation requests with the following architecture:

- **Distributed Locking**: Redis-based locks to prevent race conditions
- **Message Queue**: Bull queue for asynchronous processing of reservation requests
- **Real-time Updates**: Socket.IO for instant seat status updates
- **Distributed Caching**: Redis cache for frequent queries
- **Connection Pooling**: Optimized database connections
- **Rate Limiting**: Controls the flow of requests to prevent overload

For technical details, see the [HIGH_CONCURRENCY_SOLUTION.md](HIGH_CONCURRENCY_SOLUTION.md) document.

## Prerequisites

- Node.js (v18+)
- PostgreSQL (v14+)
- Redis (v6+)

## Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/nestjs-cinema-api.git
cd nestjs-cinema-api
```

2. Install dependencies:

```bash
npm install --legacy-peer-deps
```

Note: We use `--legacy-peer-deps` due to a version conflict between `@nestjs/bull` and `@nestjs/common@11.x`. A `.npmrc` file is included in the project to automatically apply this setting.

3. Configure environment variables:

```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Run the database migrations:

```bash
npm run migration:run
```

5. Start the development server:

```bash
npm run start:dev
```

## Demo

The system includes a demo UI for testing the seat reservation system:

```
http://localhost:3000/seat-reservation-demo.html
```

## Load Testing

To run the load test and benchmark the system:

```bash
npm run loadtest
```

## API Endpoints

### Authentication

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/refresh` - Refresh token

### Movies

- `GET /api/movies` - List all movies
- `GET /api/movies/:id` - Get movie details
- `POST /api/movies` - Create a movie (admin)
- `PUT /api/movies/:id` - Update a movie (admin)
- `DELETE /api/movies/:id` - Delete a movie (admin)

### Screenings

- `GET /api/screenings` - List screenings
- `GET /api/screenings/:id` - Get screening details
- `POST /api/screenings` - Create a screening (admin)

### Seat Reservations

- `POST /api/seat-reservations` - Reserve seats
- `DELETE /api/seat-reservations/user/:userId/screening/:screeningId` - Release reservations
- `GET /api/seat-reservations/available-seats/:screeningId` - Get available seats
- `POST /api/seat-reservations/suggest-alternatives` - Get seat alternatives

### Tickets

- `GET /api/tickets/user/:userId` - Get user tickets
- `POST /api/tickets` - Create a ticket (convert reservation to ticket)

### Payments

- `POST /api/payments` - Process payment
- `GET /api/payments/user/:userId` - Get user payment history

## WebSocket Events

The system uses Socket.IO for real-time updates:

- `join_screening` - Join a screening room
- `leave_screening` - Leave a screening room
- `seat_status_update` - Receive updates about seat status
- `seat_reserved` - Notification when seats are reserved
- `seat_released` - Notification when seats are released
- `queue_update` - Updates about queue position during high demand

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install --legacy-peer-deps
```

## Compile and run the project

```bash
# development
$ npm run start
# chạy elasticsearch
  ./elasticsearch-9.0.2/bin/elasticsearch.bat

# watch mode
$ npm run start:dev
# chạy elasticsearch
  ./elasticsearch-9.0.2/bin/elasticsearch.bat
# production mode
$ npm run start:prod
# chạy elasticsearch
  ./elasticsearch-9.0.2/bin/elasticsearch.bat
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
