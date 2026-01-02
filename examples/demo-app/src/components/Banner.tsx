export function Banner() {
  return (
    <div 
      data-testid="banner"
      className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-lg mb-6"
    >
      <h2 className="text-lg font-semibold">Welcome to AI Output Gate</h2>
      <p className="text-sm opacity-90">Testing visual regression detection</p>
    </div>
  );
}
