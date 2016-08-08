{% extends 'layouts/main.swig' %}

{% block head %}
{% parent %}
<title>View Rescue</title>
{% endblock %}

{% block body %}
{% parent %}
<div class="container-fluid">
  <h1 class="page-header">Rescue</h1>

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

        <dt class="col-sm-2">System:</dt>
        <dd class="col-sm-10">{{ system }}</dd>

        {{#if quotes}}
          <dt class="col-sm-2">Quotes:</dt>
          <dd class="col-sm-10">{{ quotes }}</dd>
        {{/if}}

        <dt class="col-sm-12">Notes:</dt>
        <dd class="col-sm-12">{{ notes }}</dd>
      </dl>
    </div>

    <div class="col-md-4">
      <div class="card">
        <div class="card-header">
          <strong>Rats</strong>
        </div>

        <ul class="list-group list-group-flush">
          {% for rat in rats %}
            <li class="list-group-item">
              {{ rat.CMDRname }}

              {% if rat.firstLimpet %}
                <span class="label label-pilllabel-primary">First Limpet</span>
              {% endif %}
            </li>
          {% endfor %}
          {% for unidentifiedRat in unidentifiedRats %}
            <li class="list-group-item">
              {{ unidentifiedRat }}
            </li>
          {% endfor %}
        </ul>
      </div>
    </div>
  </div>
</div>
{% endblock %}
