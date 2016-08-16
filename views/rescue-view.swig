{% extends 'layouts/main.swig' %}

{% block head %}
{% parent %}
<title>View Rescue</title>
{% endblock %}

{% block body %}
{% parent %}
<div class="container-fluid">
  {% if title %}
  <h1 class="page-header">Operation {{ title }}
  {% else %}
    {% if client %}
<<<<<<< HEAD
    <h1 class="page-header">Rescue of {{ client }} in {{system }}</h1>
=======
    <h1 class="page-header">Rescue of {{ client }} in {{system }}
>>>>>>> develop
    {% else %}
    <h1 class="page-header">Rescue in {{system }}
    {% endif %}
  {% endif %}
  <a href="https://api.fuelrats.com/rescues/edit/{{ id }}"><button type="button" class="btn btn-primary" id="editRescueButton">Edit</button></a>
  </h1>

  <div class="row">
    <div class="col-md-8">
      <dl class="dl-horizontal row">
        <dt class="col-sm-2">Status:</dt>
        <dd class="col-sm-10">
          {% if codeRed %}
            <span class="text-danger">CODE RED</span>
          {% endif %}
          {% if open %}
            Open
            {% if active %}
              and active
            {% else %}
              and inactive
            {% endif %}
        {% else %}
          Closed
        {% endif %}
        </dd>

        <dt class="col-sm-2">Platform:</dt>
        <dd class="col-sm-10">{{ platform }}</dd>

        <dt class="col-sm-12">Successful:</dt>
        <dd class="col-sm-12">{{ successful }}</dd>

        <dt class="col-sm-2">System:</dt>
        <dd class="col-sm-10">{{ system }}</dd>

        {% if client %}
        <dt class="col-sm-2">Client:</dt>
        <dd class="col-sm-10">{{ client }}</dd>
        {% endif %}

        <dt class="col-sm-12">Notes:</dt>
        <dd class="col-sm-12">{{ notes }}</dd>


        {% if quotes %}
          <dt class="col-sm-2">Quotes:</dt>
          <table class="table table-bordered table-striped">
            <tbody>
                {% for quote in quotes %}
                <tr>
                  <td>{{ quote }}</td>
                </tr>
                {% endfor %}
          </tbody>
        </table>
        {% endif %}
      </dl>
    </div>

    <div class="col-md-4">
      {% if firstLimpet %}
      <div class="card">
        <div class="card-header">
          <strong>First Limpet</strong>
        </div>

        <ul class="list-group list-group-flush">
          <li class="list-group-item">
            {{ firstLimpet.CMDRname }}
          </li>
        </ul>
      </div>
      {% endif %}

      <div class="card">
        <div class="card-header">
          <strong>Rats</strong>
        </div>

        {% if firstLimpet %}
        <ul class="list-group list-group-flush">
          <li class="list-group-item">
            {{ firstLimpet }}
          </li>
          {% for unidentifiedRat in unidentifiedRats %}
            <li class="list-group-item">
              {{ unidentifiedRat }}
            </li>
          {% endfor %}
        </ul>
        {% endif %}

        <ul class="list-group list-group-flush">
          {% for rat in rats %}
            <li class="list-group-item">
              {{ rat.CMDRname }}
            </li>
          {% endfor %}
        </ul>
      </div>

      {% if unidentifiedRats.length > 0 %}
      <div class="card">
        <div class="card-header">
          <strong>Unidentified Rats</strong>
        </div>

        <ul class="list-group list-group-flush">
          {% for unidentifiedRat in unidentifiedRats %}
            <li class="list-group-item">
              {{ unidentifiedRat }}
            </li>
          {% endfor %}
        </ul>
      </div>
      {% endif %}
    </div>
  </div>
</div>
{% endblock %}
