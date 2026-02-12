import xml.etree.ElementTree as ET
import sys

def extract_text(xml_path):
    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()
        
        # XML namespace for Word
        ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
        
        text_content = []
        for p in root.findall('.//w:p', ns):
            para_text = []
            for t in p.findall('.//w:t', ns):
                if t.text:
                    para_text.append(t.text)
            if para_text:
                text_content.append(''.join(para_text))
        
        print('\n'.join(text_content))
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    extract_text(sys.argv[1])
