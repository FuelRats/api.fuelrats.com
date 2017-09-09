{% extends 'layouts/main.swig' %}

{% block head %}
{% parent %}
<title>Login</title>
{% endblock %}

{% block body %}
{% parent %}

<div class="container-fluid">
  <div class="row">
    <form action="/login?legacy=1" method="post" class="col-md-6">
      <div class="page-header">
        <h1>Login</h1>
      </div>


      <div class="form-group">
        {% if reset_sent %}
          <div class="alert alert-success" role="alert">A link to reset your password will be sent to your email address and should appear within 10 minutes</div>
        {% endif %}

        {% if password_changed %}
          <div class="alert alert-success" role="alert">Your password has been changed, you may now login with your new credentials.</div>
        {% endif %}

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
      <a href="/reset">Forgotten your password?</a>
    </form>

    <form action="/register" method="post" class="col-md-6">
      <div class="page-header">
        <h1>Register</h1>
      </div>

      {% if registrationError %}
        <div class="alert alert-warning" role="alert">An error occured during registration.</div>
      {% endif %}

      <div class="form-group">
        <label for="CMDRname">CMDR Name / Gamertag (Without CMDR)</label>
        <div class="dropdown">
          <input type="text" name="CMDRname" id="CMDRname" data-autocomplete="CMDRname" class="form-control">
        </div>
      </div>

      <div class="form-group">
        <label for="platform">Platform</label>
        <label><input type="radio" name="platform" id="platform_pc" class="form-control" value="pc" checked> PC</label>
        <label><input type="radio" name="platform" id="platform_xb" class="form-control" value="xb"> Xbox One</label>
        <label><input type="radio" name="platform" id="platform_ps" class="form-control" value="ps"> PlayStation 4</label>
      </div>

      <div class="form-group">
        <label for="email">Email</label>
        <input type="email" name="email" id="email" class="form-control" autocomplete="email" required>
      </div>

      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" name="password" id="password" class="form-control" autocomplete="new-password" required>
      </div>

      <button type="submit" class="btn btn-primary">Sign up!</button>
    </form>
  </div>
</div>

{% endblock %} 
