var config, fs, Handlebars, templates;





fs = require( 'fs' );
Handlebars = require( 'handlebars' );

Handlebars.templates = {};
config = require( '../config.json' )
extension = 'hbs';





fs.readdirSync( config.templatesFolder ).forEach( function ( templatePath ) {
  var templateName;

  if ( templatePath.substring( templatePath.length, templatePath.length - extension.length ) === extension ) {
    templateName = templatePath.substr( 0, templatePath.length - extension.length - 1 );

    if ( !Handlebars.templates[templateName] ) {
      Handlebars.templates[templateName] = Handlebars.compile( fs.readFileSync( config.templatesFolder + templatePath ).toString( 'utf-8' ) );
    }
  }
});

fs.readdirSync( config.templatesFolder + config.partialsFolder ).forEach( function ( templatePath ) {
  var templateName;

  if ( templatePath.substring( templatePath.length, templatePath.length - extension.length ) === extension ) {
    templateName = templatePath.substr( 0, templatePath.length - extension.length - 1 );

    Handlebars.registerPartial( templateName, fs.readFileSync( config.templatesFolder + config.partialsFolder + templatePath ).toString( 'utf-8' ) );
  }
});

console.log( Handlebars.templates );





return;
