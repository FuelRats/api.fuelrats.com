{% extends 'layouts/main.swig' %}

{% block head %}
{% parent %}
<title>Welcome</title>

{% include 'components/addNickname.swig' %}
{% include 'components/removeNickname.swig' %}
{% include 'components/addShip.swig' %}
{% include 'components/editShip.swig' %}
{% include 'components/removeShip.swig' %}
{% endblock %}

{% block body %}
{% parent %}
<nav class="navbar navbar-light bg-faded">
  <div class="navbar-brand">Welcome, {{ user.email }} <span class="label label-pill label-{{ userGroupLabel }}">{{ user.group }}</span></div>

  <ul class="nav navbar-nav pull-xs-right">
    <li class="nav-item">
      <a href="/logout" class="nav-link">Logout</a>
    </li>
  </ul>
</nav>

<div class="container-fluid">
  <div class="row">
    <div class="col-md-3">
    <div class="card">
      <div class="card-header">
        <strong>Your CMDRs</strong>
      </div>
      <div class="card-block">
        <ul class="nav nav-stacked rat-list">
          {% for CMDR in user.rats %}
            <li class="nav-item">
              <a class="nav-link active" href="#rescues-{{ CMDR.id }}">
                {{ CMDR.CMDRname }}
                <span class="label label-pill label-default">{{ CMDR.platform|formatPlatform() }}</span>
              </a>
            </li>
          {% endfor %}
          {% if user.rats.length == 0 %}
          <div class="alert alert-info" role="alert">
            <strong>No CMDRs found</strong><br> You will not be able to file rescues to paperwork in your name unless you create a CMDR.
          </div>
          {% endif %}
        </ul>
      </div>
      <div class="card-footer">
        <div class="input-group">
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header">
        <strong>IRC Nicknames</strong>
      </div>

      <div class="card-block">
        <ul class="nav nav-stacked rat-list">
          {% for nickname in user.nicknames %}
            <li class="nav-item">
              <a class="nav-link active">
                {{ nickname }}
              </a>
              <img class="delete" data-nickname="{{ nickname }}" src="svg/delete.svg"></img>
            </li>
          {% endfor %}
          {% if user.nicknames.length == 0 %}
          <div class="alert alert-info" role="alert">
            <strong>No nicknames found</strong><br> You should connect your IRC nicknames so you will be correctly assigned when doing rescues.
          </div>
          {% endif %}
        </ul>
      </div>
      <div class="card-footer">
        <div class="input-group">
          <div class="btn-group" role="group" aria-label="Basic example">
            <button type="button" class="btn btn-secondary btn-success-outline" id="addNicknameButton">Add</button>
          </div>
        </div>
      </div>
    </div>
    <div class="card">
          <div class="card-header">
            <strong>Ships</strong>
          </div>
          <div class="card-block">
            <ul class="nav nav-stacked ship-list">
              {% for rat in user.rats %}
                {% for ship in rat.ships %}
                <li class="nav-item">
                  <a class="nav-link active">
                    {{ ship.name }}
                    <span class="label label-pill label-default">FR{{ ship.shipId|padShipId() }}</span>
                  </a>
                  <img class="delete" data-ship="{{ ship.id }}" src="svg/delete.svg"></img>
                  <img class="edit" data-ship="{{ ship.id }}" src="svg/edit.svg"></img>
                </li>
                {% endfor %}
              {% endfor %}
            </ul>
          </div>
          <div class="card-footer">
            <div class="input-group">
              <div class="btn-group" role="group" aria-label="Basic example">
                <button type="button" class="btn btn-secondary btn-success-outline" id="addShipButton">Add</button>
              </div>
            </div>
          </div>
        </div>
    </div>

    <div class="col-md-9">
      {% for CMDR in user.rats %}
        {% if CMDR.openRescues.length > 0 %}
        <h2 id="openrescues-{{ CMDR.id }}">Rescues in progress</h2>
        <table class="table table-bordered table-striped table-hover">
          <thead class="thead-default">
            <tr>
              <th>Client</th>
              <th>Opened</th>
              <th>System</th>
            </tr>
          </thead>

          <tbody>
            {% for openRescue in CMDR.openRescues %}
              <tr data-rescue="{{ openRescue.id }}">
                <td>{{ openRescue.client }}</td>
                <td>{{ openRescue.createdAt|eliteDate() }}</td>
                <td>{{ openRescue.system }}</td>
              </tr>
            {% endfor %}
          </tbody>
        </table>
        {% endif %}

        <h2 id="rescues-{{ CMDR.id }}">
          {{ CMDR.CMDRname }}
          {% if CMDR.rescues.length > 0 %}
          <small class="text-right" style="font-size: 70%">{{ CMDR.firstLimpetCount }} successful</small>
          <small class="text-right" style="font-size: 70%">{{ CMDR.assistCount }} assists</small>
          <small class="text-right" style="font-size: 70%">{{ CMDR.failureCount }} failures</small>
          <small style="font-size: 70%" class="text-muted pull-xs-right text-right">({{ CMDR.successRate}}% success)</small>
          {% else %}
          <small class="text-right" style="font-size: 70%">No Rescues</small>
          {% endif %}
        </h2>
        <hr>

        {% if CMDR.rescues %}
          <table class="table table-bordered table-striped table-hover">
            <thead class="thead-default">
              <tr>
                <th>Date</th>
                <th>Success/Failure</th>
                <th>System</th>
              </tr>
            </thead>

            <tbody>
              {% for rescue in CMDR.rescues %}
                <tr data-rescue="{{ rescue.id }}" title="{{ rescue.notes }}">
                  <td>{{ rescue.createdAt|eliteDate() }}</td>
                    {% if rescue.open %}
                    <td class="table-warning">
                      In Progress
                    {% else %}
                      {% if rescue.successful %}
                        {% if rescue.isFirstLimpet %}
                        <td class="table-success">
                          Success
                        {% else %}
                        <td class="table-info">
                          Success (Assist)
                        {% endif %}
                      {% else %}
                      <td class="table-danger">
                        Failure
                      {% endif %}
                    {% endif %}
                  </td>
                  <td>{{ rescue.system }}</td>
                </tr>
              {% endfor %}
            </tbody>
          </table>
        {% else %}
          No rescues found for {{ CMDR.CMDRname }}
        {% endif %}
      {% endfor %}
    </div>
  </div>
</div>
{% endblock %}

{% block resources %}
{% parent %}
<script src="js/profile.js" type="application/ecmascript"></script>
{% endblock %}
