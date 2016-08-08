{% extends 'layouts/main.swig' %}

{% block head %}
{% parent %}
<title>Rescue List</title>
{% endblock %}

{% block body %}
{% parent %}

<div class="container-fluid">
  <h1 class="page-header">
    Rescues

    <small class="text-muted">
      displaying page {{ page }} of {{ totalPages }}
    </small>
  </h1>

  <div class="row">
    <div class="col-md-12">
      <nav>
        <ul class="pager">
          {% if previousPage %}
            <li class="pager-prev"><a href="/rescues/list/{{ previousPage }}">Previous Page</a></li>
          {% endif %}
          {% if nextPage %}
            <li class="pager-next"><a href="/rescues/list/{{ nextPage }}">Next Page</a></li>
          {% endIf %}
        </ul>
      </nav>
    </div>

    <div class="col-md-12">
      <table class="table table-responsive table-sm table-striped table-hover" style="table-layout: fixed">
        <thead>
          <tr>
            <th>Created</th>
            <th>System</th>
            <th>First Limpet</th>
            <th>Code Red</th>
            <th>Successful</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {% for rescue in rescues %}
            <tr>
              <td>{{ rescue.createdAt|eliteDate('Y-m-d') }}</td>
              <td>{{ rescue.system }}</td>
              <td>{{ rescue.firstLimpet.CMDRname }}</td>
              <td>{{ rescue.codeRed }}</td>
              <td>{{ rescue.successful }}</td>
              <td>
                <div class="btn-group">
                  <a class="btn btn-sm btn-primary" href="/rescues/edit/{{ rescue._id }}">Edit</a>
                  <button type="button" class="btn btn-sm btn-primary dropdown-toggle" data-toggle="dropdown"></button>
                  <div class="dropdown-menu">
                    <a class="btn btn-sm btn-primary" href="/rescues/edit/{{ rescue._id }}">Edit</a>
                  </div>
                </div>
              </td>
            </tr>
          {% endfor %}
        </tbody>
      </table>
    </div>

    <div class="col-md-12">
      <nav>
        <ul class="pager">
          {% if previousPage %}
            <li class="pager-prev"><a href="/rescues/list/{{ previousPage }}">Previous Page</a></li>
          {% endif %}
          {% if nextPage %}
            <li class="pager-next"><a href="/rescues/list/{{ nextPage }}">Next Page</a></li>
          {% endif %}
        </ul>
      </nav>
    </div>
  </div>
</div>
{% endblock %}
