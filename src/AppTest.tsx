import React from 'react';

// Simple test component to verify basic React functionality
const AppTest: React.FC = () => {
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#87CEEB',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ color: '#333', marginBottom: '20px' }}>
        🎮 Minecraft Clone - Basic Test
      </h1>
      <p style={{ color: '#666', marginBottom: '10px' }}>
        React is working correctly!
      </p>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Ready to load 3D components...
      </p>
      <button 
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          backgroundColor: '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
        onClick={() => {
          console.log('Test button clicked - modules loading correctly');
          alert('Basic React functionality working!');
        }}
      >
        Test Click
      </button>
    </div>
  );
};

export default AppTest;
