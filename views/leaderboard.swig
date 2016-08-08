{% extends 'layouts/main.swig' %}

{% block head %}
{% parent %}
  <title>Fuel Rats Leaderboard</title>
{% endblock %}

{% block body %}
{% parent %}
<div class="container-fluid">
  <div class="row">
    <div id="leaderboard-container" class="col-md-5">
      <div class="card-header">
        Leaderboard
      </div>
      <table id="leaderboard" class="table table-hover table-striped">
        <thead>
          <tr>
            <th>CMDR</th>
            <th>Rescues</th>
            <th>Achievements</th>
          </tr>
        </thead>
        <tbody>
          {% for cmdr in CMDRs %}
            <tr>
              <td>{{ cmdr.CMDRname}} </td>
              <td>{{ cmdr.rescueCount }}</td>
              <td>
              {{ badge("rat") }}
              {% if cmdr.epic == true %}
              {{ badge("epic") }}
              {% endif %}
              {% if cmdr.codeRed == true %}
              {{ badge("codeRed") }}
              {% endif %}
              {% for i in Array(cmdr.pips) %}
                {{ badge("pip") }} 
              {% endfor %}
              {% if cmdr.rescueCount >= 1000 %}
              {{ badge("1000") }}
              {% endif %}
              {% if cmdr.joined|date('Y') == 2015 %}
              {{ badge("3301") }}
              {% endif %}
              </td>
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
        <div id="rescues-by-system-container" class="col-md-12">

        </div>
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

{% macro badge(type) %}
  {% if type == 'rat' %}
  <img src="svg/rat.svg" alt="Fuel Rat Badge" title="This rat has completed a rescue" class="lbBadge">
  {% endif  %}
  {% if type == 'codeRed' %}
  <img src="svg/codeRed.svg" alt="Code Red Badge" title="This rat has completed an code red rescue" class="lbBadge">
  {% endif  %}
  {% if type == 'epic' %}
  <img src="svg/epic.svg" alt="Epic Badge" title="This rat has completed an epic rescue or other epic achievement" class="lbBadge">
  {% endif  %}
  {% if type == 'pip' %}
  <img src="svg/pip.svg" alt="100 Rescues Pip" title="Each pip represents 100 rescues the rat has completed" class="lbBadge">
  {% endif  %}
  {% if type == '1000' %}
  <img src="svg/1000.svg" alt="Epic Badge" title="This rat has completed over 1000 rescues" class="lbBadge">
  {% endif  %}
  {% if type == '3301' %}
  <img src="svg/3301.svg" alt="3301 Badge" title="This rat completed a rescue in year 3301" class="lbBadge">
  {% endif  %}
{% endmacro %}
