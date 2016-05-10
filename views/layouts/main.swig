<!doctype html>
<head>
  <link rel="stylesheet" href="/style.min.css">
  {% block head %}
  {% endblock %}
</head>
<body>
  {% block body %}
  {% endblock %}

  {% block resources %}
  <script src="//cdnjs.cloudflare.com/ajax/libs/jquery/3.0.0-alpha1/jquery.min.js"></script>
  <link rel="stylesheet" href="//cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/4.0.0-alpha/css/bootstrap.min.css">
  <script src="//cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/4.0.0-alpha/js/bootstrap.min.js"></script>

  <script src="//cdnjs.cloudflare.com/ajax/libs/d3/3.5.17/d3.min.js"></script>
  <script src="//cdnjs.cloudflare.com/ajax/libs/moment.js/2.11.1/moment.min.js"></script>
  <script src="//cdnjs.cloudflare.com/ajax/libs/underscore.js/1.8.3/underscore-min.js"></script>
  <script src="//cdnjs.cloudflare.com/ajax/libs/handlebars.js/4.0.5/handlebars.min.js"></script>
  <script src="//cdnjs.cloudflare.com/ajax/libs/backbone.js/1.2.3/backbone-min.js"></script>
  <script src="//cdnjs.cloudflare.com/ajax/libs/backbone.marionette/2.4.4/backbone.marionette.min.js"></script>
  <script src="//cdnjs.cloudflare.com/ajax/libs/backbone.stickit/0.8.0/backbone.stickit.min.js"></script>

  {% endblock %}
</body>
