# api.fuelrats.com

[![Dependencies](http://img.shields.io/david/FuelRats/api.fuelrats.com.svg?style=flat-square)](https://david-dm.org/FuelRats/api.fuelrats.com)
[![Open Github Issues](http://img.shields.io/github/issues/FuelRats/api.fuelrats.com.svg?style=flat-square)](https://github.com/FuelRats/api.fuelrats.com/issues)
[![Travis CI Build](http://img.shields.io/travis/FuelRats/api.fuelrats.com.svg?style=flat-square)](https://travis-ci.org/FuelRats/api.fuelrats.com)
![Coveralls Coverage Report](http://img.shields.io/coveralls/FuelRats/api.fuelrats.com.svg?style=flat-square)

## Development

[Vagrant](vagrantup.com) allows us to run a local virtual machine clone of our production environment with ease. Make sure you have Vagrant installed (Check out [this article](https://servercheck.in/blog/running-ansible-within-windows) if you're on Windows), then run:

    vagrant up

Vagrant will do everything we need:

1. Download an Ubuntu virtual machine image;
1. Set up SSH access on the vm which we can access with `vagrant ssh`;
1. Provision our vm using Ansible to set up Node and all the dependencies we need;
1. Start our API with [`forever`](https://www.npmjs.com/package/forever); and
1. Import all archived rats and rescues from the Google spreadsheets.

Once Vagrant finishes doing its thing you should be able to hit the API at `http://localhost:8080`. When you're done you can kill the Vagrant machine with `vagrant destroy` or, if you don't want to wait for the VM to be rebuilt from scratch, you can just pause the VM with `vagrant halt`.
