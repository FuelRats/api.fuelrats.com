# api.fuelrats.com

[![Dependencies](http://img.shields.io/david/FuelRats/api.fuelrats.com.svg?style=flat-square)](https://david-dm.org/FuelRats/api.fuelrats.com)
[![Open Github Issues](http://img.shields.io/github/issues/FuelRats/api.fuelrats.com.svg?style=flat-square)](https://github.com/FuelRats/api.fuelrats.com/issues)
[![Travis CI Build](http://img.shields.io/travis/FuelRats/api.fuelrats.com.svg?style=flat-square)](https://travis-ci.org/FuelRats/api.fuelrats.com)
![Coveralls Coverage Report](http://img.shields.io/coveralls/FuelRats/api.fuelrats.com.svg?style=flat-square)

## Setting up

### With Vagrant

[Vagrant](vagrantup.com) allows us to run a local virtual machine clone of our production environment with ease. Make sure you have Vagrant installed (Check out [this article](https://servercheck.in/blog/running-ansible-within-windows) if you're on Windows), then run:

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
1. [`MongoDB`](https://www.mongodb.com/)
1. [`Elasticsearch`](https://www.elastic.co/)

You'll also need to make sure that Elasticsearch is running before you start the API by either executing `elasticsearch` in your terminal or starting it as a service ([Windows](https://www.elastic.co/guide/en/elasticsearch/reference/current/setup-service-win.html)|[Mac OS X](http://stackoverflow.com/questions/22850247/installing-elasticsearch-on-osx-mavericks/#answer-22855889)|[Linux](https://www.elastic.co/guide/en/elasticsearch/reference/current/setup-service.html)).

Grab the repo:

    git clone https://github.com/FuelRats/api.fuelrats.com.git

Install all of the required Node modules:

    cd api.fuelrats.com
    npm install

Now start the server!

    npm run dev

This will ensure that Mongo is running as a service and start the API itself on either port 8080 or whatever port you've set in `config.json`.

### Common Problems

#### "Error: No Living connections"

Elasticsearch isn't running. Refer to the [Running Without Vagrant](#without-vagrant) section. You may need to install Java to get it working.

## Development

To work for realsies you need to copy the `config-example.json` file and update any settings you need changed:

    cp config-example.json config.json

The `npm run dev` task starts the API with `node-dev` which will automatically restart the API when you change a file. Simply kill the process when you're done. Good luck, and may the force be with you.
