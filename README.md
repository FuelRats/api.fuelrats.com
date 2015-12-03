# api.fuelrats.com

[![Dependencies](http://img.shields.io/david/FuelRats/api.fuelrats.com.svg?style=flat-square)](https://david-dm.org/FuelRats/api.fuelrats.com)
[![Open Github Issues](http://img.shields.io/github/issues/FuelRats/api.fuelrats.com.svg?style=flat-square)](https://github.com/FuelRats/api.fuelrats.com/issues)
[![Travis CI Build](http://img.shields.io/travis/FuelRats/api.fuelrats.com.svg?style=flat-square)](https://travis-ci.org/FuelRats/api.fuelrats.com)
![Coveralls Coverage Report](http://img.shields.io/coveralls/FuelRats/api.fuelrats.com.svg?style=flat-square)

## Development

To get the system up and running, `cd` into your new repository and install all of the required Node modules:

    npm install
    npm install -g grunt-cli

After that, development should be easy! Use our `dev` task to get everything up and running:

    npm run dev

Then you can hit the API at [http://localhost:8080](http://localhost:8080). You can also change the port (defaults to `8080`) and the salt used to hash passwords in the database in `config.json`

## Testing

Make sure to start a server first, then run all of the test suites:

    npm run dev
    npm test

## Importing Archives

There are a couple of import scripts available in the `bin` folder for grabbing the rats and rescues currently listed in our Google spreadsheets. You can run them with the `node` CLI:

    node bin/import-rats
    node bin/import-rescues
