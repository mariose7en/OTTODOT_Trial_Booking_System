import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-8 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Logo size="sm" showText={false} />
            <span className="font-heading text-xl font-bold text-ottodot-blue">
              OTTODOT
            </span>
          </div>

          <div className="text-center md:text-right">
            <p className="text-gray-400 text-sm">
              Trial Booking System for Live Online Science & Math Classes
            </p>
            <p className="text-gray-500 text-xs mt-1">
              Game-based learning for Primary 1-6
            </p>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-800 text-center text-xs text-gray-500">
          &copy; {new Date().getFullYear()} Ottodot. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
