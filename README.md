# api.fuelrats.com

[![node](https://img.shields.io/node/v/api.fuelrats.com.svg?style=flat-square)](https://nodejs.org)
[![Dependencies](http://img.shields.io/david/FuelRats/api.fuelrats.com.svg?style=flat-square)](https://david-dm.org/FuelRats/api.fuelrats.com)
[![Open Github Issues](http://img.shields.io/github/issues/FuelRats/api.fuelrats.com.svg?style=flat-square)](https://github.com/FuelRats/api.fuelrats.com/issues)
[![Travis CI Build](http://img.shields.io/travis/FuelRats/api.fuelrats.com.svg?style=flat-square)](https://travis-ci.org/FuelRats/api.fuelrats.com)

## Setting up

### With Vagrant

[Vagrant](vagrantup.com) allows us to run a local virtual machine clone of our production environment with ease. Make sure you have Vagrant installed (Check out [this article](https://servercheck.in/blog/running-ansible-within-windows) if you're on Windows), then run:

Please make note that you need a 64-bit system for this to work.

    vagrant up

Vagrant will do everything we need:

1. Download an Ubuntu virtual machine image;
1. Set up SSH access on the vm which we can access with `vagrant ssh`;
1. Provision our vm using Ansible to set up Node and all the dependencies we need;
1. Start our API with [`forever`](https://www.npmjs.com/package/forever); and
1. Import all archived rats and rescues from the Google spreadsheets.

Once Vagrant finishes doing its thing you should be able to hit the API at `http://localhost:8080`. When you're done you can kill the Vagrant machine with `vagrant destroy` or, if you don't want to wait for the VM to be rebuilt from scratch, you can just pause the VM with `vagrant halt`.

### Without Vagrant

So you wanna do it the hard way? Fine. Make sure you install all of the dependencies:

1. [`nvm`](https://github.com/creationix/nvm)
1. [`node v6.3.1`](https://nodejs.org/en/)
1. [`Postgres v9.4`](https://www.postgresql.org/)

Grab the repo:

    git clone https://github.com/FuelRats/api.fuelrats.com.git

Install all of the required Node modules:

    cd api.fuelrats.com
    npm install webpack@^2.1.0-beta
    npm install -g grunt-cli
    npm install

Make sure that you have created the databases required:

    su postgres
    psql -c 'CREATE DATABASE fuelrats;' -U postgres
    psql -c 'CREATE DATABASE fuelratsTest;' -U postgres
    psql -c 'CREATE USER fuelrats;' -U postgres
    psql -c "ALTER USER fuelrats PASSWORD 'fuelrats';" -U postgres
    exit

And if you want to use a different username or password, you can use them instead and set the new ones in your `config.json`

Now start the server!

    npm run dev

This will ensure that Postgres is running as a service and start the API itself on either port 8080 or whatever port you've set in `config.json`.

### Common Problems

#### "Missing indexes" or an empty object is returned

Your databases are empty, home slice. You can use our [import script](bin/import.js) to grab a bunch of archived FuelRats data.

## Development

To work for realsies you need to copy the `config-example.json` file and update any settings you need changed:

    cp config-example.json config.json


The `npm run dev` task starts the API and will automatically restart it when you change a file. Simply kill the process when you're done. Good luck, and may the force be with you.

## Generating the docs

It's so easy a DerryBear could do it! Just run the generator script:

    node bin/compile-docs.js
