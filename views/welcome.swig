{% extends 'layouts/main.swig' %}

{% block head %}
{% parent %}
<title>Welcome</title>
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
                <span class="label label-pill label-default">{{ CMDR.platform }}</span>
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
          <div class="btn-group" role="group" aria-label="Basic example">
            <button type="button" class="btn btn-secondary btn-success-outline">Add</button>
            <button type="button" class="btn btn-secondary btn-warning-outline">Edit</button>
            <button type="button" class="btn btn-secondary btn-danger-outline">Remove</button>
          </div>
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
            <button type="button" class="btn btn-secondary btn-success-outline">Add</button>
            <button type="button" class="btn btn-secondary btn-warning-outline" disabled>Edit</button>
            <button type="button" class="btn btn-secondary btn-danger-outline" disabled>Remove</button>
          </div>
        </div>
      </div>
    </div>
    </div>

    <div class="col-md-9">
      {% for CMDR in user.rats %}
        <h2 id="rescues-{{ CMDR.id }}">
          {{ CMDR.CMDRname }}
          <small class="text-right" style="font-size: 70%">{{ CMDR.firstLimpetCount }} successful</small>
          <small class="text-right" style="font-size: 70%">{{ CMDR.assistCount }} assists</small>
          <small class="text-right" style="font-size: 70%">{{ CMDR.failureCount }} failures</small>
          <small style="font-size: 70%" class="text-muted pull-xs-right text-right">({{ CMDR.successRate}}% success)</small>
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
                <tr title="{{ rescue.notes }}">
                  <td>{{ rescue.createdAt|eliteDate() }}</td>
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
<script src="paperwork.js" type="application/ecmascript"></script>
{% endblock %}
