# api.fuelrats.com

[![node](https://img.shields.io/node/v/api.fuelrats.com.svg?style=flat-square)](https://nodejs.org)
[![Dependencies](http://img.shields.io/david/FuelRats/api.fuelrats.com.svg?style=flat-square)](https://david-dm.org/FuelRats/api.fuelrats.com)
[![Open Github Issues](http://img.shields.io/github/issues/FuelRats/api.fuelrats.com.svg?style=flat-square)](https://github.com/FuelRats/api.fuelrats.com/issues)
[![Travis CI Build](http://img.shields.io/travis/FuelRats/api.fuelrats.com.svg?style=flat-square)](https://travis-ci.org/FuelRats/api.fuelrats.com)

## Setting up
<!--
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
-->

So, first of you need to fetch a few things and install. These should be available as packages from you favorite package manager.

1. [`nvm`](https://github.com/creationix/nvm)
2. [`yarn`](https://yarnpkg.com/lang/en/docs/install/)
1. [`Postgres v9.4`](https://www.postgresql.org/)

Grab the repo:

    git clone https://github.com/FuelRats/api.fuelrats.com.git

Install all of the required Node modules:

    cd api.fuelrats.com
    nvm install 8.0.0
    yarn

Make sure that you have created the databases required:

    su postgres
    psql -c 'CREATE DATABASE fuelrats;' -U postgres
    psql -c 'CREATE EXTENSION citext;' -U postgres fuelrats
    psql -c 'CREATE DATABASE fuelratsTest;' -U postgres
    psql -c 'CREATE EXTENSION citext;' -U postgres fuelratstest
    psql -c 'CREATE USER fuelrats;' -U postgres
    psql -c "ALTER USER fuelrats PASSWORD 'SqueakBaby';" -U postgres
    exit

And if you want to use a different username or password, you can use them instead and set the new ones in your `config.json`

Now start the server!

    npm run dev

This will ensure that Postgres is running as a service and start the API itself on either port 8082 or whatever port you've set in `config.json`.

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

## License
Copyright 2017 The Fuel Rats Mischief

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.    