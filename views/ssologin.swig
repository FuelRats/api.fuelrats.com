{% extends 'layouts/main.swig' %}

{% block head %}
{% parent %}
<title>Login to Jira / Confluence</title>
{% endblock %}

{% block body %}
{% parent %}

<div class="container-fluid">
  <div class="col-md-8 col-md-offset-4">
    <form action="/ssologin" method="post" class="col-md-6">
      <div class="page-header">
        <h1>Login to Jira / Confluence</h1>
      </div>


      <div class="form-group">
        {% if error_login %}
          <div class="alert alert-warning" role="alert">Wrong username or password.</div>
        {% endif %}

        <label for="email">Email</label>
        <input type="email" name="email" id="email" class="form-control" autocomplete="off" required>
      </div>

      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" name="password" id="password" class="form-control" autocomplete="current-password" required>
      </div>

      <button type="submit" class="btn btn-primary">Login</button>
      <a href="/reset">Forgotten your password?</a><br/>
      <p style="margin-top: 20px"><a href="/register">Don't have an account? Register</a></p>
    </form>
  </div>
</div>

{% endblock %}
