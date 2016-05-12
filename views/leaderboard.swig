{% extends 'layouts/main.swig' %}

{% block head %}
{% parent %}
  <title>Fuel Rats Leaderboard</title>
{% endblock %}

{% block body %}
{% parent %}
<div class="container-fluid">
  <div class="row">
    <div id="leaderboard-container" class="col-md-4">
      <div class="card-header">
        Leaderboard
      </div>
      <table id="leaderboard" class="table table-hover table-striped">
        <thead>
          <tr>
            <th>CMDR</th>
            <th>Rescues</th>
          </tr>
        </thead>
        <tbody>
          {% for cmdr in CMDRs %}
            <tr>
              <td>{{ cmdr.CMDRname}} </td>
              <td>{{ cmdr.successfulRescueCount }}</td>
            </tr>
          {% endfor %}
        </tbody>
      </table>
    </div>
    <div class="col-md-8">
      <div class="row">
        <div id="rescues-by-date-container" class="col-md-12"></div>
      </div>
      <div class="row">
        <div id="rescues-by-system-container" class="col-md-12"></div>
      </div>
    </div>
  </div>
</div>
{% endblock %}

{% block resources %}
{% parent %}

<script src="//cdnjs.cloudflare.com/ajax/libs/tether/1.2.0/js/tether.min.js"></script>
<script src="statistics.js"></script>
{% endblock %}
