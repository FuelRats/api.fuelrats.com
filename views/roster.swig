{% extends 'layouts/main.swig' %}

{% block head %}
{% parent %}
<title>Roster</title>

{% endblock %}

{% block body %}
{% parent %}
<div class="container-fluid">
  <div class="row">
    <div class="col-md-6">
      <table class="table table-bordered table-striped table-hover">
        <thead class="thead-default">
          <tr>
            <th>CMDR</th>
            <th>Drilled</th>
            <th>Dispatch Drilled</th>
            <th>Joined</th>
          </tr>
        </thead>

        <tbody>
          {% for rat in rats %}
            <tr>
              <td>{{ rat.CMDRname }}</td>
              {% if rat.user %}
                {% if rat.user.drilled %}
                <td class="table-success">Yes</td>
                {% else %}
                <td class="table-warning">No</td>
                {% endif %}

                {% if rat.user.drilledDispatch %}
                <td class="table-success">Yes</td>
                {% else %}
                <td class="table-warning">No</td>
                {% endif %}
              {% else %}
              <td class="table-info">Unknown</td>
              <td class="table-info">Unknown</td>
              {% endif %}
              <td>{{ rat.joined|eliteDate() }}</td>
            </tr>
          {% endfor %}
        </tbody>
      </table>
    </div>
  </div>
</div>
{% endblock %}
