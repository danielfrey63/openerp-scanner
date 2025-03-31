# MCP Rules

## Retrieving Tasks

### Understanding Custom Fields Structure
Custom fields in Asana are structured with both a field ID and a value ID. Examples:
* Task Type field ID: 1209801751853566
* Priority field ID: 1209801961072592
* Refactor task type value: 1209801751853567
* Low priority value: 1209801961072597

### Effective Search Strategy
First, search for all tasks in the target project to understand the custom field structure:
```asana
asana_search_tasks
  workspace: 37822924311874
  projects.any: 1209572842673316
  opt_fields: custom_fields
```
Analyze the results to identify tasks with specific custom field values. Examples:
* Look for tasks where "Task Type" is set to "Refactor"
* Look for tasks where "Priority" is set to "Low"

### Key Learnings
* The parameter `projects.any` must be used (not `projects` or `projects_any`) to filter by project.
* Custom fields appear in the format "field name (field ID)" with values in the format "value name (value ID)".
* To filter by custom fields, you need both the "field ID" and the specific "value ID".
* When searching for tasks with specific criteria, it's often helpful to first retrieve all tasks and analyze the structure before applying specific filters.

### Troubleshooting
If direct filtering by custom field values doesn't work, an alternative approach is:

1. Retrieve all tasks in the project
2. Examine the custom fields structure
3. Filter the results programmatically based on the custom field values