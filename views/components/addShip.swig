<template id="addShipDialogTemplate">
  <div class="modal fade" id="addShipDialog" tabindex="-1" role="dialog" aria-labelledby="Add Ship">
    <div class="modal-dialog" role="document">
      <div class="modal-content">
        <div class="modal-header">
          <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
          <h4 class="modal-title" id="myModalLabel">Add Ship</h4>
        </div>
        <div class="modal-body">
            <p id="shipRatGroup">
                <label>Select the CMDR that owns this ship</label><br/>

            </p>
            <label for="shipTypeField">Ship Type</label>
            <select name="shipTypeField" id="shipTypeField">
            </select></br>
            <label for="shipNameField">Ship Name</label>
          <input type="text" class="form-control" placeholder="Ship Name" aria-describedby="Ship Name" id="shipNameField">
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-default" data-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-primary" id="addShipButton">Add</button>
        </div>
      </div>
    </div>
  </div>
</template>