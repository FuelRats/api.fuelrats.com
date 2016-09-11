{% extends 'layouts/main.swig' %}

{% block head %}
{% parent %}
<title>Roster</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/datatables/1.10.12/css/dataTables.bootstrap4.min.css">
{% endblock %}

{% block body %}
{% parent %}
<div class="container">
  <h1>Overseers and Rats</h1>
  <p>As a new rat you will be encouraged to undergo drilling before we unleash you on our clients. There are certain things that must happen when you are drilled <a href="http://www.fuelrats.com/newrat/what-to-expect-on-your-drill/" target="_blank">(see here)</a>. An overseer (listed below) must be present for your drill to be administered and logged. When the overseer is satisfied that you are fully equipped with the knowledge you need he/she will begin the process of adding you to the list of drilled rats. The overseer can put your drill on hold and give you advice before the drill is continued, the overseer can also declare your drill a failure and may suggest that you perform another drill before you go on a live rescue. If your drill has to be halted (depending on the reason) this may result in a drill failure. The same conditions apply for Dispatch drills.</p>

  <h3 style="margin-top: 5rem">Overseers</h3>
  <p>
    {% for overseer in overseers %}
      | {{ overseer.CMDRname }}
    {% endfor %}
  </p>
  <p>You can spot an overseer by looking for the standard issue overseer hat</p>
  <img src="https://www.fuelrats.com/wp-content/uploads/2015/11/Overseer-Hat.jpg" alt="overseer hat">

  <p style="margin-top: 1rem">And our drill damsels look similar to this</p>
  <img src="http://www.fuelrats.com/wp-content/uploads/2015/11/Drill-Damsels-dress-188x300.jpg" alt="overseer hat">

  <h3 style="margin-top: 5rem">Rats</h3>
  <div class="row">
    <div class="col-md-6">
      <table class="table table-bordered table-striped table-hover" id="roster"><thead class="thead-default">
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
              <td>{{ rat.joined|eliteDateNoFormat() }}</td>
            </tr>
          {% endfor %}
        </tbody>
      </table>
    </div>
  </div>
</div>
{% endblock %}

{% block resources %}
{% parent %}
<script src="https://cdnjs.cloudflare.com/ajax/libs/datatables/1.10.12/js/jquery.dataTables.min.js" type="application/ecmascript"></script>
<script>
$('#roster').DataTable({
  "paging":   false,
  "order": [[ 3, "desc" ]]
});
</script>
{% endblock %}
