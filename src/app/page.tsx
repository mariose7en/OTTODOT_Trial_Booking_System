import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-ottodot-blue/20 via-white to-ottodot-green/20 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center mb-6">
            <img src="/logo.webp" alt="Ottodot" className="h-24" />
          </div>

          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-4 font-heading">
            Welcome to{" "}
            <span className="text-gradient">OTTODOT</span>
          </h1>

          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Game-based learning for Primary 1-6 Math & Science. Book your trial
            class today!
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/bookings"
              className="btn-ottodot btn-ottodot-yellow px-8 py-4 text-lg"
            >
              Book a Trial Class
            </Link>
            <Link
              href="/roster"
              className="btn-ottodot btn-ottodot-blue px-8 py-4 text-lg"
            >
              View Roster
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12 font-heading">
            Why Choose Ottodot?
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="card-playful text-center">
              <div className="text-5xl mb-4">🎮</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Game-Based Learning
              </h3>
              <p className="text-gray-600">
                Interactive lessons that make learning fun and engaging for
                kids.
              </p>
            </div>

            <div className="card-playful text-center">
              <div className="text-5xl mb-4">👨‍🏫</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Live Online Classes
              </h3>
              <p className="text-gray-600">
                Real-time interaction with expert teachers from home.
              </p>
            </div>

            <div className="card-playful text-center">
              <div className="text-5xl mb-4">📊</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Track Progress
              </h3>
              <p className="text-gray-600">
                Monitor your child's improvement with detailed reports.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Subjects Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12 font-heading">
            Our Trial Classes
          </h2>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="card-playful flex items-center gap-6">
              <div className="text-6xl">🔢</div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Math</h3>
                <p className="text-gray-600">
                  Arithmetic, problem-solving, and mathematical thinking
                </p>
                <p className="text-sm text-ottodot-green font-semibold mt-2">
                  Primary 1-6
                </p>
              </div>
            </div>

            <div className="card-playful flex items-center gap-6">
              <div className="text-6xl">🔬</div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Science</h3>
                <p className="text-gray-600">
                  Physics, chemistry, and biology fundamentals
                </p>
                <p className="text-sm text-ottodot-green font-semibold mt-2">
                  Primary 1-6
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-ottodot-blue">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4 font-heading">
            Ready to Start Learning?
          </h2>
          <p className="text-blue-100 mb-8 max-w-xl mx-auto">
            Book a free trial class and see the Ottodot difference. Limited
            seats available!
          </p>
          <Link
            href="/bookings"
            className="btn-ottodot btn-ottodot-yellow px-8 py-4 text-lg inline-block"
          >
            Book Your Free Trial
          </Link>
        </div>
      </section>
    </div>
  );
}
