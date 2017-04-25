<template id="decalDialogTemplate">
<div class="modal fade" id="decalDialog" tabindex="-1" role="dialog" aria-labelledby="Fuel Rats Decal">
    <div class="modal-dialog" role="document">
      <div class="modal-content">
        <div class="modal-header">
          <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
          <h4 class="modal-title" id="myModalLabel">Fuel Rats Decal</h4>
        </div>
        <div class="modal-body">
          <p>
            <b>This is your redeem code for an in-game Fuel Rats decal</b><br>
            You may copy the redeem code and enter it in the product access section of your <a target="_blank" href="https://www.frontierstore.net/customer/accountpage/index/">Frontier Store Account</a>.
          </p>
          <div class="input-group">
            <input type="text" class="form-control" placeholder="Decal Redeem Code" id="decal-redeem" readonly>
            <span class="input-group-btn">
              <button class="btn copy" type="button" data-clipboard-target="#decal-redeem">
                <img src="svg/copy.svg" alt="Copy to clipboard">
              </button>
            </span>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>
