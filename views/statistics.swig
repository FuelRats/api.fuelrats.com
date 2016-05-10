{% extends 'layouts/main.swig' %}

{% block head %}
{% parent %}
  <title>Fuel Rats Leaderboard</title>
{% endblock %}

{% block body %}
{% parent %}
<div id="leaderboard"></div>
{% endblock %}

{% block resources %}
{% parent %}

<!-- Base Classes -->
<script src="/models/Base.js"></script>
<script src="/collections/Base.js"></script>

<!-- Model Classes -->
<script src="/models/Rescue.js"></script>
<script src="/models/Statistics.js"></script>

<!-- Collection Classes -->
<script src="/collections/Rescues.js"></script>

<!-- View Classes -->
<script src="/views/Leaderboard.js"></script>
<script src="/views/RescuesByDate.js"></script>
<script src="/views/RescuesBySystem.js"></script>
<script src="//cdnjs.cloudflare.com/ajax/libs/tether/1.2.0/js/tether.min.js"></script>
<script src="statistics.js"></script>
{% endblock %}
