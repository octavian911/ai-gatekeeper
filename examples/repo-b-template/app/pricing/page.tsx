export default function PricingPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#fafafa',
      padding: '60px 20px'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h1 style={{
            fontSize: '48px',
            fontWeight: '700',
            marginBottom: '16px',
            color: '#1a1a1a'
          }}>
            Simple, transparent pricing
          </h1>
          <p style={{
            fontSize: '20px',
            color: '#666'
          }}>
            Choose the plan that's right for you
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '32px'
        }}>
          <div style={{
            background: 'white',
            padding: '40px',
            borderRadius: '12px',
            border: '1px solid #e5e5e5'
          }}>
            <h3 style={{
              fontSize: '24px',
              fontWeight: '600',
              marginBottom: '8px',
              color: '#1a1a1a'
            }}>
              Starter
            </h3>
            <p style={{
              color: '#666',
              marginBottom: '24px',
              fontSize: '14px'
            }}>
              Perfect for small teams
            </p>
            <div style={{ marginBottom: '32px' }}>
              <span style={{
                fontSize: '48px',
                fontWeight: '700',
                color: '#1a1a1a'
              }}>
                $29
              </span>
              <span style={{
                fontSize: '16px',
                color: '#666'
              }}>
                /month
              </span>
            </div>
            <ul style={{
              listStyle: 'none',
              marginBottom: '32px'
            }}>
              <li style={{ padding: '8px 0', color: '#333', fontSize: '14px' }}>✓ Up to 10 users</li>
              <li style={{ padding: '8px 0', color: '#333', fontSize: '14px' }}>✓ 5GB storage</li>
              <li style={{ padding: '8px 0', color: '#333', fontSize: '14px' }}>✓ Email support</li>
            </ul>
            <button style={{
              width: '100%',
              padding: '12px',
              background: 'white',
              color: '#667eea',
              border: '2px solid #667eea',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer'
            }}>
              Get started
            </button>
          </div>

          <div style={{
            background: 'white',
            padding: '40px',
            borderRadius: '12px',
            border: '2px solid #667eea',
            position: 'relative'
          }}>
            <div style={{
              position: 'absolute',
              top: '-12px',
              right: '20px',
              background: '#667eea',
              color: 'white',
              padding: '4px 12px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: '600'
            }}>
              POPULAR
            </div>
            <h3 style={{
              fontSize: '24px',
              fontWeight: '600',
              marginBottom: '8px',
              color: '#1a1a1a'
            }}>
              Pro
            </h3>
            <p style={{
              color: '#666',
              marginBottom: '24px',
              fontSize: '14px'
            }}>
              For growing businesses
            </p>
            <div style={{ marginBottom: '32px' }}>
              <span style={{
                fontSize: '48px',
                fontWeight: '700',
                color: '#1a1a1a'
              }}>
                $79
              </span>
              <span style={{
                fontSize: '16px',
                color: '#666'
              }}>
                /month
              </span>
            </div>
            <ul style={{
              listStyle: 'none',
              marginBottom: '32px'
            }}>
              <li style={{ padding: '8px 0', color: '#333', fontSize: '14px' }}>✓ Up to 50 users</li>
              <li style={{ padding: '8px 0', color: '#333', fontSize: '14px' }}>✓ 50GB storage</li>
              <li style={{ padding: '8px 0', color: '#333', fontSize: '14px' }}>✓ Priority support</li>
              <li style={{ padding: '8px 0', color: '#333', fontSize: '14px' }}>✓ Advanced analytics</li>
            </ul>
            <button style={{
              width: '100%',
              padding: '12px',
              background: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer'
            }}>
              Get started
            </button>
          </div>

          <div style={{
            background: 'white',
            padding: '40px',
            borderRadius: '12px',
            border: '1px solid #e5e5e5'
          }}>
            <h3 style={{
              fontSize: '24px',
              fontWeight: '600',
              marginBottom: '8px',
              color: '#1a1a1a'
            }}>
              Enterprise
            </h3>
            <p style={{
              color: '#666',
              marginBottom: '24px',
              fontSize: '14px'
            }}>
              For large organizations
            </p>
            <div style={{ marginBottom: '32px' }}>
              <span style={{
                fontSize: '48px',
                fontWeight: '700',
                color: '#1a1a1a'
              }}>
                $199
              </span>
              <span style={{
                fontSize: '16px',
                color: '#666'
              }}>
                /month
              </span>
            </div>
            <ul style={{
              listStyle: 'none',
              marginBottom: '32px'
            }}>
              <li style={{ padding: '8px 0', color: '#333', fontSize: '14px' }}>✓ Unlimited users</li>
              <li style={{ padding: '8px 0', color: '#333', fontSize: '14px' }}>✓ Unlimited storage</li>
              <li style={{ padding: '8px 0', color: '#333', fontSize: '14px' }}>✓ 24/7 phone support</li>
              <li style={{ padding: '8px 0', color: '#333', fontSize: '14px' }}>✓ Custom integrations</li>
            </ul>
            <button style={{
              width: '100%',
              padding: '12px',
              background: 'white',
              color: '#667eea',
              border: '2px solid #667eea',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer'
            }}>
              Contact sales
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
