import os
import re
from typing import Any, Dict

def parse_simple_yaml(content: str) -> Dict[str, Any]:
    lines = content.splitlines()
    result: Dict[str, Any] = {}
    stack = [(0, result)]
    
    for line in lines:
        # Strip comments
        line = re.sub(r'#.*$', '', line).rstrip()
        if not line.strip():
            continue
            
        indent = len(line) - len(line.lstrip())
        line_content = line.strip()
        if ':' not in line_content:
            continue
            
        key, val = line_content.split(':', 1)
        key = key.strip()
        val = val.strip()
        
        while stack and stack[-1][0] >= indent and len(stack) > 1:
            stack.pop()
            
        parent_dict = stack[-1][1]
        
        if val == "":
            new_dict: Dict[str, Any] = {}
            parent_dict[key] = new_dict
            stack.append((indent + 1, new_dict))
        else:
            if val.lower() == 'true':
                parsed_val: Any = True
            elif val.lower() == 'false':
                parsed_val = False
            elif val.startswith('"') and val.endswith('"'):
                parsed_val = val[1:-1]
            elif val.startswith("'") and val.endswith("'"):
                parsed_val = val[1:-1]
            else:
                try:
                    if '.' in val:
                        parsed_val = float(val)
                    else:
                        parsed_val = int(val)
                except ValueError:
                    parsed_val = val
            parent_dict[key] = parsed_val
            
    return result

class Configuration:
    def __init__(self, config_dict: Dict[str, Any]):
        self._data = self._to_uppercase_dict(config_dict)
        self._initialized = True
        
    def _to_uppercase_dict(self, d: Dict[str, Any]) -> Dict[str, Any]:
        new_dict: Dict[str, Any] = {}
        for k, v in d.items():
            k_upper = k.upper()
            if isinstance(v, dict):
                new_dict[k_upper] = self._to_uppercase_dict(v)
            else:
                new_dict[k_upper] = v
        return new_dict
        
    def __getattr__(self, name: str) -> Any:
        name_upper = name.upper()
        if '_data' in self.__dict__ and name_upper in self._data:
            val = self._data[name_upper]
            if isinstance(val, dict):
                return Configuration(val)
            return val
        raise AttributeError(f"'Configuration' object has no attribute '{name}'")
        
    def __setattr__(self, name: str, value: Any):
        if '_initialized' in self.__dict__ and self._initialized:
            raise TypeError("Configuration parameters are read-only and cannot be changed.")
        super().__setattr__(name, value)
        
    def __delattr__(self, name: str):
        raise TypeError("Configuration parameters are read-only and cannot be changed.")

    def get(self, name: str, default: Any = None) -> Any:
        try:
            return self.__getattr__(name)
        except AttributeError:
            return default

def load_config(path: str = "config.yml") -> Configuration:
    if not os.path.exists(path):
        raise FileNotFoundError(f"Config file not found: {path}")
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    config_dict = parse_simple_yaml(content)
    return Configuration(config_dict)
