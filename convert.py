import pandas as pd
import json
import subprocess
import os

# Path to the uploaded Excel file
excel_path = r'C:\Users\Laptop 122\Desktop\Store Prep\06 Employee Reports\Website\EmployeeProductionExport.xlsx'
repo_path = r'C:\Users\Laptop 122\Desktop\Store Prep\06 Employee Reports\Website'  # Local path to your git repo



# Read all sheets into a dict of DataFrames
all_sheets = pd.read_excel(excel_path, sheet_name=None)

# Convert each sheet to a list of record dicts, replacing NaN with 0
json_data = {
    sheet_name: df.fillna(0).to_dict(orient='records')
    for sheet_name, df in all_sheets.items()
}

# Write the combined JSON to a file, using default=str to serialize dates/times
output_path = r'C:\Users\Laptop 122\Desktop\Store Prep\06 Employee Reports\Website\EmployeeProductionExport.json'

with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(json_data, f, indent=4, ensure_ascii=False, default=str)

print(f"Converted {len(all_sheets)} sheet(s) to JSON (NaNs→0) and saved to: {output_path}")


# Git operations
try:
    # Navigate to repo
    os.chdir(repo_path)

    # Add the JSON file
    subprocess.run(['git', 'add', repo_path], check=True)

    # Commit with a message
    subprocess.run(['git', 'commit', '-m', 'Auto-update: converted Excel to JSON'], check=True)

    # Push to the remote repository
    subprocess.run(['git', 'push'], check=True)

    print("Changes pushed to the remote repository.")

except subprocess.CalledProcessError as e:
    print("Git operation failed:", e)