{% extends 'layouts/main.swig' %}

{% block head %}
{% parent %}
<title>Reset Password</title>
{% endblock %}

{% block body %}
{% parent %}

<div class="container-fluid">
  <div class="row">
    <form action="/reset" method="post" class="col-md-6">
      <div class="page-header">
        <h1>Reset Password</h1>
      </div>

      {% if not_found %}
        <div class="alert alert-warning" role="alert">This email address was not found</div>
      {% endif %}

      {% if expired %}
        <div class="alert alert-warning" role="alert">This reset link has expired. To request a new one, enter your email address.</div>
      {% endif %}

      <div class="form-group">
        <label for="email">Email</label>
        <input type="email" name="email" id="email" class="form-control" autocomplete="off" required>
      </div>

      <button type="submit" class="btn btn-primary">Reset</button>
    </form>
  </div>
</div>
{% endblock %}
