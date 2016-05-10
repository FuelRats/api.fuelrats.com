{% extends 'layouts/main.swig' %}

{% block head %}
{% parent %}
<title>Change Pasword</title>
{% endblock %}

{% block body %}
{% parent %}
<div class="container-fluid">
  <div class="row">
    <form action="/change_password" method="post" class="col-md-6">
      <div class="page-header">
        <h1>Change Password</h1>
      </div>

      <div class="form-group">
        <label for="email">New Password</label>
        <input type="password" name="password" id="password" class="form-control" autocomplete="current-password" required>
        <input type="hidden" name="token" id="token" class="form-control" readonly value="{{token}}">
      </div>

      <button type="submit" class="btn btn-primary">Change Password</button>
    </form>
  </div>
</div>

{% endblock %}
