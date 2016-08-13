<!doctype html>
<head>
  <link rel="stylesheet" href="/style.min.css">
  {% block head %}
  {% endblock %}
</head>
<body style="margin: 0">
  {% block body %}
  <iframe src="https://www.fuelrats.com/too-quiet/" scrolling="no" style="height: 180px; width: 100%; overflow: hidden;"></iframe>
  {% endblock %}

  {% block resources %}
  <script src="//cdnjs.cloudflare.com/ajax/libs/jquery/3.0.0-alpha1/jquery.min.js"></script>
  <link rel="stylesheet" href="//cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/4.0.0-alpha/css/bootstrap.min.css">
  <script src="//cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/4.0.0-alpha/js/bootstrap.min.js"></script>

  <script src="//cdnjs.cloudflare.com/ajax/libs/moment.js/2.11.1/moment.min.js"></script>
  <script src="//cdnjs.cloudflare.com/ajax/libs/underscore.js/1.8.3/underscore-min.js"></script>

  {% endblock %}
</body>
