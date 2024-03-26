# Digital Commerce Core Reference Template

This is the base reference application for the Conga ecommerce product. Follow below instructions to get started. See the [docs](https://congarevenuecloud.github.io/202402.2.0/) for more detailed instructions on interacting with the underlying SDK.

---

## Table of content

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Build](#build)
- [Product identifier](#product-identifier)
- [Angular CLI Command](#code-scaffolding)
- [Running unit tests](#running-unit-tests)
- [Running end-to-end tests](#running-end-to-end-tests)
- [Digital Commerce SDK](#digital-commerce-sdk)
- [Digital Commerce for REST API Developers](#digital-commerce-for-rest-api-developers)
- [Further help](#further-help)

<div id="prerequisites"/>

## Prerequisites

You will need Node js, npm, and Angular CLI to work with this project

- Node js with npm
- Angular
- Angular CLI

To ensure you have them available on your machine, please run the following commands.

`npm -v` Checks npm version,

`node -v` Checks Node js version,

`ng --version` Checks Angular CLI version.

<div id="installation"/>

## Installation

---

### Platform & tools

You need to install Node.js and then the development tools. Node.js comes with a package manager called [npm](http://npmjs.org) for installing NodeJS applications and libraries.

- [Node.js](http://nodejs.org)

- [Angular](https://angular.io/docs)

- [Angular CLI](https://angular.io/cli)

### Get the Code

Either clone this repository or fork it on GitHub and clone your fork.

```
git clone https://github.com/congarevenuecloud/e-commerce
```

### Update .npmrc file

To install below SDK library versions from **package.json** you need to setup auth token in `.npmrc` file.

```
@congarevenuecloud:registry=https://npm.pkg.github.com
npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

The following SDK libraries from **package.json** where the latest versions will be updated:-

```
1.  "@congarevenuecloud/core": "^package version",
2.  "@congarevenuecloud/ecommerce": "^package version",
3.  "@congarevenuecloud/elements": "^package version",
```

### Dependency installation

To install dependency run npm install command.

```
npm install
```

### Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory. Use the `--prod` flag or `npm run build` for a production build.

### Updating the environment file

The `endpoint`, `clientId` and `authority` fields in the environment file will be replaced with details of your Conga platform instance.

### Serving the application

**Development Mode**

> Run `ng serve` for a dev server. Navigate to `https://localhost:3000`. The app will automatically reload if you change any of the source files.
**Production Mode**

> Run `ng serve --aot` for a production server. Navigate to `https://localhost:3000`. The app will automatically reload if you change any of the source files.
<div id="product-identifier"/>

## Product identifier

By default, routing to products in the reference template is dependent on the product code. However, if you wish to use a different field to route to products, you can set the 'productIdentifier' parameter in the config file
to any product field

```json
{
  "productIdentifier": "ProductCode"
}
```

<div id="code-scaffolding"/>

## Angular CLI Command

Run `ng generate component component-name` to generate a new component. You can also use `ng generate` to generate directives, pipes, guards etc as mentioned below

`ng generate directive|pipe|service|class|guard|interface|enum|module`.

<div id="running-unit-tests"/>

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

<div id="running-end-to-end-tests"/>

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via [Protractor](http://www.protractortest.org/).

<div id="digital-commerce-sdk"/>

## Digital Commerce SDK

The objective of this section is to provide information about reference templates, base libraries, models, and components that can be inherited and reused. This section also provides information about services that are sufficient for most of the business logic. You can create orders, request quotes, and more with the **SDK libraries**. See the [Docs](https://congarevenuecloud.github.io/202402.2.0/) for more information.

<div id="digital-commerce-for-rest-api-developers"/>

## Digital Commerce for REST API Developers

This section is designed to provide administrators with information on the CPQ API references that enables commerce into any part of an application.

Refer the [Docs](https://developer.conga.com/revenue) to get detailed information of CPQ APIs.

<div id="further-help"/>

## Further help

[Bootstrap](https://getbootstrap.com/docs/4.1/getting-started/introduction/)