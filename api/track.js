const axios = require('axios');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let query = req.method === 'POST' ? req.body.query : req.query.query;
    
    if (!query) {
      return res.status(400).json({ 
        error: 'Please provide mobile number or CNIC',
        format: 'Mobile: 03XXXXXXXXX or CNIC: 1234512345671',
        credit: 'Credit: @AZ_Tricks (https://t.me/AZ_Tricks)'
      });
    }

    let cleanQuery = query.replace(/[^0-9]/g, '');
    
    if (cleanQuery.length < 10) {
      return res.status(400).json({
        error: 'Invalid input. Minimum 10 digits required',
        format: 'Mobile: 03XXXXXXXXX (11 digits) or CNIC: 1234512345671 (13 digits)',
        credit: 'Credit: @AZ_Tricks (https://t.me/AZ_Tricks)'
      });
    }

    const response = await axios.post(
      'https://freshsimtracker.com/numberDetails.php',
      `numberCnic=${cleanQuery}&searchNumber=search`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
          'Host': 'freshsimtracker.com',
          'Origin': 'https://freshsimtracker.com',
          'Referer': 'https://freshsimtracker.com/',
          'X-Requested-With': 'mark.via.gp',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
          'Cache-Control': 'max-age=0',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 30000
      }
    );

    const html = response.data;
    const result = parseHTML(html, cleanQuery);
    const searchType = cleanQuery.length === 13 ? 'CNIC' : 'Mobile Number';
    
    return res.status(200).json({
      search_type: searchType,
      input: cleanQuery,
      number: result.number || 'Not Found',
      name: result.name || 'Not Found',
      cnic: result.cnic || 'Not Found',
      address: result.address || 'Not Found',
      status: result.status || 'Failed',
      credit: 'Credit: @AZ_Tricks (https://t.me/AZ_Tricks)'
    });

  } catch (error) {
    console.error('Error:', error.message);
    return res.status(500).json({
      error: 'Service temporarily unavailable. Please try again later.',
      credit: 'Credit: @AZ_Tricks (https://t.me/AZ_Tricks)'
    });
  }
};

function parseHTML(html, query) {
  const result = {
    number: 'Not Found',
    name: 'Not Found',
    cnic: 'Not Found',
    address: 'Not Found',
    status: 'Failed'
  };

  try {
    // Clean HTML
    const cleanHtml = html.replace(/\s+/g, ' ').trim();
    
    // Extract all visible text
    const textContent = cleanHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Find table data specifically
    const tableRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
    const tdMatches = [];
    let match;
    while ((match = tableRegex.exec(html)) !== null) {
      const value = match[1].replace(/<[^>]*>/g, '').trim();
      if (value) tdMatches.push(value);
    }
    
    // Extract data from table cells
    if (tdMatches.length > 0) {
      // Find name (usually in second cell)
      for (let i = 0; i < tdMatches.length; i++) {
        const value = tdMatches[i];
        
        // Check if this looks like a name (alphabetic, 2+ words)
        if (/^[A-Za-z\s]{3,}$/.test(value) && value.length > 3 && !value.includes('@') && !value.includes('.')) {
          if (result.name === 'Not Found' || result.name.includes('Network')) {
            result.name = value;
          }
        }
        
        // Check for CNIC (13 digits)
        const cnicMatch = value.match(/\b[0-9]{13}\b/);
        if (cnicMatch) {
          result.cnic = cnicMatch[0];
        }
        
        // Check for mobile (11 digits starting with 03)
        const mobileMatch = value.match(/\b03[0-9]{9}\b/);
        if (mobileMatch) {
          if (result.number === 'Not Found' || result.number.includes('Network')) {
            result.number = mobileMatch[0];
          }
        }
        
        // Check for address (contains city, street, etc)
        if (/[A-Za-z]+\s+[A-Za-z]+,\s*[A-Za-z]+/i.test(value) || 
            /Street|Road|Colony|Town|City|District|Province/i.test(value)) {
          if (result.address === 'Not Found' || result.address.includes('Network')) {
            result.address = value;
          }
        }
      }
    }
    
    // If CNIC not found, search in entire text
    if (result.cnic === 'Not Found') {
      const cnicMatch = textContent.match(/\b[0-9]{13}\b/);
      if (cnicMatch) {
        result.cnic = cnicMatch[0];
      }
    }
    
    // If number not found, search in entire text
    if (result.number === 'Not Found') {
      const numberMatch = textContent.match(/\b03[0-9]{9}\b/);
      if (numberMatch) {
        result.number = numberMatch[0];
      }
    }
    
    // Better name extraction from table structure
    const namePatterns = [
      /Name\s*[:：]\s*([A-Za-z\s]+)/i,
      /Customer\s*[:：]\s*([A-Za-z\s]+)/i,
      /Owner\s*[:：]\s*([A-Za-z\s]+)/i,
      /Subscriber\s*[:：]\s*([A-Za-z\s]+)/i,
      /Holder\s*[:：]\s*([A-Za-z\s]+)/i
    ];
    
    for (let pattern of namePatterns) {
      const nameMatch = textContent.match(pattern);
      if (nameMatch && nameMatch[1] && nameMatch[1].trim().length > 2) {
        const name = nameMatch[1].trim();
        if (!name.includes('Network') && !name.includes('Address') && !name.includes('CNIC')) {
          result.name = name;
          break;
        }
      }
    }
    
    // Better address extraction
    const addressPatterns = [
      /Address\s*[:：]\s*([A-Za-z0-9\s,.\-]+)/i,
      /Location\s*[:：]\s*([A-Za-z0-9\s,.\-]+)/i,
      /City\s*[:：]\s*([A-Za-z\s]+)/i,
      /District\s*[:：]\s*([A-Za-z\s]+)/i
    ];
    
    for (let pattern of addressPatterns) {
      const addrMatch = textContent.match(pattern);
      if (addrMatch && addrMatch[1] && addrMatch[1].trim().length > 2) {
        const address = addrMatch[1].trim();
        if (!address.includes('Network') && !address.includes('CNIC') && !address.includes('030')) {
          result.address = address;
          break;
        }
      }
    }
    
    // If address still has garbage data, try to extract clean address
    if (result.address.includes('Network') || result.address.includes('030') || result.address.includes('GHULAM')) {
      // Look for proper address format
      const cleanAddrMatch = textContent.match(/([A-Za-z]+(?:\s+[A-Za-z]+)*,\s*[A-Za-z]+(?:\s+[A-Za-z]+)*)/);
      if (cleanAddrMatch) {
        result.address = cleanAddrMatch[1];
      } else {
        // Try to find address from table
        for (let i = 0; i < tdMatches.length; i++) {
          const value = tdMatches[i];
          if (value.includes('Street') || value.includes('Road') || value.includes('Colony') || 
              value.includes('Town') || value.includes('City') || value.includes('District')) {
            result.address = value;
            break;
          }
        }
      }
    }
    
    // If name has garbage data, clean it
    if (result.name.includes('Network') || result.name.includes('Address') || result.name.includes('CNIC')) {
      // Try to find proper name from table
      for (let i = 0; i < tdMatches.length; i++) {
        const value = tdMatches[i];
        if (/^[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(value) && !value.includes('@') && !value.includes('.')) {
          result.name = value;
          break;
        }
      }
    }
    
    // Clean CNIC - remove dashes
    if (result.cnic !== 'Not Found') {
      result.cnic = result.cnic.replace(/[^0-9]/g, '');
    }
    
    // Clean number - remove dashes
    if (result.number !== 'Not Found') {
      result.number = result.number.replace(/[^0-9]/g, '');
    }
    
    // Check if we found valid data
    if (result.name !== 'Not Found' && result.name !== 'CNIC Address Network' && 
        !result.name.includes('Network') && !result.name.includes('Address')) {
      result.status = 'Success';
    } else if (result.cnic !== 'Not Found' || result.number !== 'Not Found') {
      result.status = 'Success';
    }
    
    // Final cleanup - if name still has garbage, set to Not Found
    if (result.name === 'CNIC Address Network' || result.name.includes('Network')) {
      result.name = 'Not Found';
    }
    
    if (result.address === 'CNIC Address Network' || result.address.includes('Network')) {
      result.address = 'Not Found';
    }
    
    // Remove any CNIC or number from address
    if (result.address !== 'Not Found') {
      result.address = result.address.replace(/\b[0-9]{11,13}\b/g, '').trim();
      result.address = result.address.replace(/GHULAM\s+MURTAZA/g, '').trim();
      result.address = result.address.replace(/Network/g, '').trim();
      if (result.address === '') result.address = 'Not Found';
    }

  } catch (e) {
    console.error('Parsing error:', e);
  }

  return result;
            }
