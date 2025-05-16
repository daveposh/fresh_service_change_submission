const express = require('express');
const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Change Request Form App');
});

// Mandatory app settings handler
function onSettingsUpdate(args) {
  console.log('onSettingsUpdate invoked with following data: \n', args);
  
  // Validate the settings
  const validationErrors = [];
  
  // Validate risk level
  if (!args.defaultRiskLevel || !['low', 'medium', 'high', 'critical'].includes(args.defaultRiskLevel)) {
    validationErrors.push('Invalid default risk level');
  }
  
  // Validate email
  if (args.notificationEmail && !args.notificationEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    validationErrors.push('Invalid notification email');
  }
  
  // Validate maintenance windows
  if (args.maintenanceWindows) {
    try {
      const windows = JSON.parse(args.maintenanceWindows);
      if (!Array.isArray(windows)) {
        validationErrors.push('Maintenance windows must be an array');
      }
    } catch (e) {
      validationErrors.push('Invalid maintenance windows format');
    }
  }
  
  if (validationErrors.length > 0) {
    renderData({
      message: 'Validation failed',
      errors: validationErrors
    });
  } else {
    renderData({
      message: 'Settings validated successfully'
    });
  }
}

// Export the onSettingsUpdate function
module.exports = {
  onSettingsUpdate
};

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 