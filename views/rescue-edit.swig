{% extends 'layouts/main.swig' %}

{% block head %}
{% parent %}
<title>Fuel rats - Edit Rescue</title>
{% endblock %}

{% block body %}
{% parent %}
<meta id="meta-id" name='rescue-id' value="{{ rescue.id }}">
<div class="container-fluid">
  <h1>Edit Case</h1>
  <form id="paperwork" action="/rescues" method="put">
    <div class="form-group">
      <label for="rats">Who arrived for the rescue?</label>
      <input type="text" name="rats" id="rats" class="form-control" value="" required>
    </div>

    <div class="form-group">
      <label for="firstLimpet">Who fired the first limpet?</label>
      <input type="text" name="firstLimpet" id="firstLimpet" class="form-control" data-autocomplete="CMDRname" value="{{ rat.CMDRname }}">
    </div>

    <div class="form-group">
      <label for="successful">What platform was it on?</label>
      <br>
      <div class="radio-inline">
        <label>
          <input type="radio" id="platform-pc" name="platform" value="pc">
          PC
        </label>
      </div>
      <div class="radio-inline">
        <label>
          <input type="radio" id="platform-xb" name="platform" value="xb">
          Xbox One
        </label>
      </div>
      <div class="radio-inline">
        <label>
          <input type="radio" id="platform-ps" name="platform" value="ps">
          PlayStation 4
        </label>
      </div>
    </div>

    <div class="form-group">
      <label for="system">Where did it happen?</label>
      <small>In what star system did the rescue took place? (put "n/a" if not applicable)</small>
      <input type="text" name="system" id="system" class="form-control" required autofocus>
    </div>

    <div class="form-group">
      <label for="successful">Was the rescue successful?</label>
      <br>
      <div class="radio-inline">
        <label>
          <input type="radio" id="successful-true" name="successful" value="true">
          Yes
        </label>
      </div>
      <div class="radio-inline">
        <label>
          <input type="radio" id="successful-false" name="successful" value="false">
          No
        </label>
      </div>
    </div>

    <div class="form-group">
      <label for="codeRed">Was it a code red?</label>
      <br>
      <div class="radio-inline">
        <label>
          <input type="radio" id="cr-true" name="codeRed" value="true">
          Yes
        </label>
      </div>
      <div class="radio-inline">
        <label>
          <input type="radio" id="cr-false" name="codeRed" value="false">
          No
        </label>
      </div>
    </div>

    <div class="form-group">
      <label for="notes">Notes</label>
      <textarea name="notes" id="notes" class="form-control"></textarea>
    </div>

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

    <button type="submit" class="btn btn-primary">Submit</button>
  </form>
</div>
{% endblock %}

{% block resources %}
{% parent %}
<link rel="stylesheet" href="//cdnjs.cloudflare.com/ajax/libs/jquery.bootstrapvalidator/0.5.1/css/bootstrapValidator.min.css">
<script src="//cdnjs.cloudflare.com/ajax/libs/jquery.bootstrapvalidator/0.5.1/js/bootstrapValidator.min.js"></script>
<script src="//cdnjs.cloudflare.com/ajax/libs/typeahead.js/0.11.1/typeahead.bundle.min.js"></script>
<script src="//cdnjs.cloudflare.com/ajax/libs/backbone.js/1.2.3/backbone-min.js"></script>
<script src="//cdnjs.cloudflare.com/ajax/libs/backbone.marionette/2.4.4/backbone.marionette.min.js"></script>
<script src="//cdnjs.cloudflare.com/ajax/libs/backbone.stickit/0.8.0/backbone.stickit.min.js"></script>
<script src="/bootstrap-tagsinput.js"></script>
<script src="/js/rescue-edit.js"></script>
{% endblock %}
