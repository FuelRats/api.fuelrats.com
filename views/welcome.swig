{% extends 'layouts/main.swig' %}

{% block head %}
{% parent %}
<title>Welcome</title>
{% endblock %}

{% block body %}
{% parent %}
<nav class="navbar navbar-light bg-faded">
  <div class="navbar-brand" data-pgroup="{{ group }}">Welcome, {{ email }}</div>

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
<!--        <ul class="list-group list-group-flush rat-list">-->
          <ul class="nav nav-stacked rat-list">
            {% for CMDR in CMDRs %}
  <!--            <li class="list-group-item">-->
              <li class="nav-item">
                <a class="nav-link active" href="#rescues-{{ CMDR._id }}">
                  {{ CMDR.CMDRname }}
                  <span class="label label-pill label-default">{{ CMDR.platform }}</span>
                </a>
              </li>
            {% endfor %}
          </ul>
        </div>

        <div class="card-footer form-inline rat-adder" hidden>
          <div class="row">
            <input type="text" placeholder="Add Rat" class="form-control" data-autocomplete="CMDRname">
            <button type="button" class="btn btn-primary">Add</button>
          </div>
        </div>
      </div>
    </div>

    <div class="col-md-9">
      {% for CMDR in CMDRs %}
        <h2 id="rescues-{{ CMDR._id }}">
          {{ CMDRname }}
          <small class="text-muted pull-xs-right">{{ CMDR.rescues.length }} rescues</small>
        </h2>
        <hr>

        {% if CMDR.rescues %}
          <table class="table table-bordered table-striped table-hover">
            <thead class="thead-default">
              <tr>
                <th>Date</th>
                <th>Success/Failure</th>
                <th>System</th>
                <!--<th>Notes</th>-->
              </tr>
            </thead>

            <tbody>
              {% for rescue in CMDR.rescues %}
                <tr>
                  <td>{{ rescue.createdAt|eliteDate() }}</td>
                  <td class="{% if rescue.successful %} table-success {% else %} table-danger {% endif %}">
                    {% if rescue.successful %}
                      {% if rescue.assist %}
                        Success (Assist)
                      {% else %}
                        Success
                      {% endif %}
                    {% else %}
                      Failure
                    {% endif %}
                  </td>
                  <td>{{ rescue.system }}</td>
                  <!--<td>{{ rescue.notes }}</td>-->
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
{% endblock %}
